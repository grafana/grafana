package mtctx

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/grafana/grafana/pkg/api/response"
	"github.com/grafana/grafana/pkg/cmd/grafana-cli/logger"
	"github.com/grafana/grafana/pkg/infra/appcontext"
	"github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/sqlstore"
	"github.com/grafana/grafana/pkg/services/sqlstore/session"
	"github.com/grafana/grafana/pkg/setting"
	v1 "k8s.io/api/core/v1"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/watch"
	"k8s.io/client-go/kubernetes"
)

type serviceImpl struct {
	namespace string
	clientset *kubernetes.Clientset
	cache     map[int64]*TenantInfo
	//watchers  map[int64]watch.Interface
}

// POC: shows stackID of tenant in current request
func (s *serviceImpl) showTenantInfo(c *models.ReqContext) response.Response {
	t, err := TenantInfoFromContext(c.Req.Context())
	if err != nil {
		fmt.Println("Could not find tenant info", err)
		return response.JSON(500, map[string]interface{}{
			"nope":        "nope",
			"user":        c.SignedInUser,
			"HG_STACK_ID": os.Getenv("HG_STACK_ID"),
		})
	}

	// Try to initalize the DB
	if !t.DBInitalized {
		_ = t.GetSessionDB()
	}

	return response.JSON(200, t)
}

// Gets config.ini from kubernetes and returns a watcher to listen for changes
func (s *serviceImpl) GetStackConfigWatcher(ctx context.Context, stackID int64) (watch.Interface, error) {
	if s.clientset == nil {
		return nil, fmt.Errorf("missing error")
	}

	return s.clientset.CoreV1().ConfigMaps("hosted-grafana").Watch(ctx, metav1.ListOptions{
		FieldSelector: fmt.Sprintf("metadata[name]=%s", stackName(stackID)),
	})
}

// MIDDLEWARE: Adds TenantInfo
func (s *serviceImpl) Middleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// only run if on api
		if !strings.HasPrefix(r.RequestURI, "/api") {
			next.ServeHTTP(w, r)
			return
		}

		ctx := r.Context()
		user, err := appcontext.User(ctx)
		if err != nil {
			fmt.Println("missing user", err)
			next.ServeHTTP(w, r)
			return
		}

		// Try to set it from environment (only relevant for single tenant setup)
		if user.StackID == 0 {
			v := os.Getenv("HG_STACK_ID")
			if v == "" {
				v = "6" // VSCODE DEBUGGER ENVIRONMENT
			}
			stackID, err := strconv.ParseInt(v, 10, 64)
			if err == nil {
				user.StackID = stackID
			}
		}

		// Check cache for config by stackID
		info, ok := s.cache[user.StackID]

		// If no config, get one
		if !ok {
			var config *v1.ConfigMap
			info = &TenantInfo{StackID: user.StackID}

			// get the initial config map
			if s.clientset != nil {
				info.Config, info.Err = s.clientset.CoreV1().ConfigMaps(s.namespace).Get(context.TODO(), stackName(user.StackID), metav1.GetOptions{})
			} else {
				info.Err = fmt.Errorf("missing client")
			}

			logger.Info("POTATO: context set: %v", config)

			//	s.cache[user.StackID] = info

			// Get config watcher
			//w, err := s.GetStackConfigWatcher(context.TODO(), stackID)
			//if err != nil {
			//fmt.Println("Error getting watcher for stackID:", stackID)
			//}

			// TODO should we check to see if we already have a watcher?
			// Also, we don't currently have a scenario where we remove a watcher, but we
			// should think through this.
			//if cachedWatcher, ok := s.watchers[stackID]; ok {
			//  // this should never happen

			//  cachedWatcher.Stop() // make sure we stop listening
			//  fmt.Println("WARNING: we found a watcher for a tenant that was missing tenantInfo")
			//}

			//// queue watcher
			//s.watchers[stackID] = w
		}

		ctx = ContextWithTenantInfo(ctx, info)
		next.ServeHTTP(w, r.WithContext(ctx))
	})
}

// TODO: Finish me. Don't need for demo.
// Watches config maps for changes to tenant configs and removing tenants.
// Context is so we can cancel this blocking call, not a web context
//func (s *serviceImpl) WatchConfigMaps(ctx context.Context) {
//  agg := make(chan string)

//  // collect channels from all watchers
//  var chans []channel
//  for _, c := range s.watchers {
//    chans := append(chans, c)
//  }

//  // all config updates are handled the same. aggregaggregate them into a single channel we can use to
//  // receive
//  for _, ch := range chans {
//    go func(c chan string) {
//      for msg := range c {
//        agg <- msg
//      }
//    }(ch)
//  }

//  select {
//  case msg <- agg:
//    fmt.Println("received ", msg)
//  }
//}

// Builds the kubernetes stackname
func stackName(stackID int64) string {
	return fmt.Sprintf("%d-mt-config", stackID)
}

// takes INI, initializes db connection and returns it
func initializeDBConnection(config *v1.ConfigMap) (*session.SessionDB, error) {
	if config == nil {
		return nil, fmt.Errorf("missing config")
	}
	jsontxt, ok := config.Data["ini.json"]
	if !ok {
		return nil, fmt.Errorf("could not find key ini")
	}

	jsonmap := make(map[string]map[string]string, 0)
	err := json.Unmarshal([]byte(jsontxt), &jsonmap)
	if err != nil {
		return nil, err
	}
	cfg, err := setting.FromJSON(jsonmap)
	if err != nil {
		return nil, err
	}

	// a whole new instance?   ┗|・o・|┛
	ss, err := sqlstore.NewSQLStore(cfg, nil, nil, nil, nil, nil)
	if err != nil {
		return nil, err
	}

	return ss.GetSqlxSession(), nil
}
