// Package bridge provides interfaces
// for communicating with an underlying kube-apiserver.
package bridge

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"os"
	"path/filepath"

	"github.com/grafana/grafana/pkg/kinds/dashboard"
	"github.com/grafana/grafana/pkg/kindsys/k8ssys"
	"github.com/grafana/grafana/pkg/registry/corecrd"
	"k8s.io/apimachinery/pkg/runtime"
	k8schema "k8s.io/apimachinery/pkg/runtime/schema"
	"k8s.io/apimachinery/pkg/runtime/serializer"
	"k8s.io/client-go/rest"
	"k8s.io/client-go/tools/clientcmd"
	ctrl "sigs.k8s.io/controller-runtime"
	"sigs.k8s.io/controller-runtime/pkg/scheme"

	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/services/featuremgmt"
	"github.com/grafana/grafana/pkg/setting"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

// Service is the service that registers all schemas, CRDs and clients to Kubernetes.
// It is also responsible for registering and managing Kubernetes controllers and providing client Config.
type Service struct {
	enabled   bool
	config    *rest.Config
	ClientSet *Clientset
	manager   ctrl.Manager
	logger    log.Logger
}

// ProvideService returns a new Service which registers models from list.
// It is disabled if the Apiserver flag is disabled in the feature toggles.
func ProvideService(cfg *setting.Cfg, feat featuremgmt.FeatureToggles, reg *corecrd.Registry) (*Service, error) {
	enabled := feat.IsEnabled(featuremgmt.FlagApiserver)
	if !enabled {
		return &Service{
			enabled: false,
		}, nil
	}

	config, err := LoadRestConfig(cfg)
	if err != nil {
		return nil, err
	}

	models := reg.All()

	scheme, err := GenerateScheme(models)
	if err != nil {
		return nil, err
	}

	config.NegotiatedSerializer = serializer.WithoutConversionCodecFactory{
		CodecFactory: serializer.NewCodecFactory(scheme),
	}

	clientset, err := NewClientset(config)
	if err != nil {
		return nil, err
	}

	for _, mod := range models {
		fmt.Println("POTATO", mod.Schema.APIVersion, "-", mod.Schema.Kind, "-", mod.Schema.ObjectMeta.Name)
	}

	mgr, err := ctrl.NewManager(config, ctrl.Options{
		Scheme: scheme,
	})
	if err != nil {
		return nil, err
	}

	s := &Service{
		config:    config,
		ClientSet: clientset,
		manager:   mgr,
		enabled:   enabled,
		logger:    log.New("apimachinery.bridge.service"),
	}

	if err := s.RegisterModels(context.TODO(), models...); err != nil {
		return nil, err
	}

	s.createDashboard(reg, clientset)

	//fmt.Printf("clientset.CRDs: %v\n", clientset.CRDs)
	//for _, crd := range clientset.CRDs {
	//fmt.Println("POTATO", crd.APIVersion, "-", crd.Kind)
	//}

	return s, nil
}

// IsDisabled
func (s *Service) IsDisabled() bool {
	return !s.enabled
}

// Run
func (s *Service) Run(ctx context.Context) error {
	if err := s.manager.Start(ctx); err != nil {
		return err
	}

	return nil
}

// RegisterModels registers models to clientset and controller manager.
func (s *Service) RegisterModels(ctx context.Context, crds ...k8ssys.Kind) error {
	for _, crd := range crds {
		if err := s.ClientSet.RegisterSchema(ctx, crd); err != nil {
			return err
		}

		// if err := m.RegisterController(s.manager); err != nil {
		// 	return err
		// }
	}

	return nil
}

// RestConfig returns rest Config for talking to kube-apiserver.
func (s *Service) RestConfig() *rest.Config {
	return s.config
}

// LoadRestConfig loads rest.Config based on settings in cfg.
func LoadRestConfig(cfg *setting.Cfg) (*rest.Config, error) {
	sec := cfg.Raw.Section("apiserver.kubebridge")
	configPath := sec.Key("kubeconfig_path").MustString("")

	if configPath == "" {
		return nil, errors.New("kubeconfig path cannot be empty when using a proxy apiserver")
	}

	configPath = filepath.Clean(configPath)

	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("cannot find kubeconfig file at '%s'", configPath)
	}

	c, err := clientcmd.BuildConfigFromFlags("", configPath)
	if err != nil {
		return nil, err
	}

	c.APIPath = "/apis"

	return c, err
}

// GenerateScheme generates a kubernetes runtime Scheme from a list of models.
func GenerateScheme(kinds []k8ssys.Kind) (*runtime.Scheme, error) {
	res := runtime.NewScheme()

	for _, crd := range kinds {
		// TODO needs refactor to support custom kinds
		gvk := crd.GVK() // Group Version Kind = GVK

		schemaBuilder := &scheme.Builder{
			GroupVersion: k8schema.GroupVersion{
				Group:   gvk.Group,
				Version: gvk.Version,
			},
		}

		if err := schemaBuilder.AddToScheme(res); err != nil {
			return nil, err
		}

		s := schemaBuilder.Register(crd.Object, crd.ObjectList)

		gv := s.GroupVersion
		metav1.AddToGroupVersion(res, gv)
		res.AddKnownTypeWithName(gv.WithKind(gvk.Kind), crd.Object)
		res.AddKnownTypeWithName(gv.WithKind(fmt.Sprintf("%sList", gvk.Kind)), crd.ObjectList)
	}

	return res, nil
}

func (s *Service) createDashboard(reg *corecrd.Registry, clientSet *Clientset) {
	namespace := "default"
	// take the kindsys dashboard kind and alias it so it's easier to distinguish from dashboards.Dashboard
	type dashboardKind = dashboard.Dashboard
	// get the dashboard CRD from the CRD registry
	dashboardCRD := reg.Dashboard()
	// map native Grafana dashboard object to kindsys dashboard object

	Uid := "ABCDIMAUID"
	Title := "IMAK8SDASHIE"

	d := dashboardKind{
		Uid:   &Uid,
		Title: &Title,
	}

	labels := make(map[string]string)
	annotations := make(map[string]string)

	b := k8ssys.Base[dashboardKind]{
		TypeMeta: metav1.TypeMeta{
			Kind:       dashboardCRD.GVK().Kind,
			APIVersion: dashboardCRD.GVK().Group + "/" + dashboardCRD.GVK().Version,
		},
		ObjectMeta: metav1.ObjectMeta{
			Namespace:   namespace,
			Name:        *d.Title,
			Labels:      labels,
			Annotations: annotations,
		},
		Spec: d,
	}

	raw, err := json.Marshal(&b)
	if err != nil {
		panic(err)
	}

	fmt.Println("json", string(raw))
	status := 0
	fmt.Println("UID", "uid", dashboardCRD.Schema.Spec.Names.Plural+"."+dashboardCRD.GVK().Group)
	req := clientSet.RESTClient().
		Post().
		Resource(dashboardCRD.Schema.Spec.Names.Plural).
		Namespace(namespace).
		Name(*d.Title).
		Body(raw)

	// should be
	// https://localhost:8443/apis/dashboard.core.grafana.com/v0-0alpha1/namespaces/default/dashboards?limit=500
	fmt.Println("req", req.URL())

	res, err := req.
		Do(context.TODO()).
		StatusCode(&status).
		Raw()

	if err != nil {
		panic(err)
	}

	fmt.Println(string(res))
}

//func (s *Service) getResource(kind string, namespace string) (dynamic.ResourceInterface, error) {
//  kindMapping := map[string]schema.GroupVersionResource{
//    //"ConfigMap":             {Group: "", Version: "v1", Resource: "configmaps"},
//  }

//  fmt.Printf("%#v", s.ClientSet.CRDs)

//  gvr, found := kindMapping[kind]
//  if !found {
//    return nil, fmt.Errorf("unknown kind: '%s'", kind)
//  }

//  var resource dynamic.ResourceInterface
//  //if kind == "Namespace" {
//    //resource = s.dynamic.Resource(gvr)
//  //} else {
//    //resource = s.dynamic.Resource(gvr).Namespace(namespace)
//  //}

//  return resource, nil
//}
