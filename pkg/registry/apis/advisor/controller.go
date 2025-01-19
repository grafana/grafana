package advisor

import (
	"context"

	"github.com/grafana/authlib/claims"
	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/apimachinery/utils"
	"github.com/grafana/grafana/pkg/infra/log"
	"github.com/grafana/grafana/pkg/registry/apis/advisor/models"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
	"k8s.io/apimachinery/pkg/runtime"
	genericapirequest "k8s.io/apiserver/pkg/endpoints/request"
)

type updateReq struct {
	ctx context.Context
	obj runtime.Object
}

type controller struct {
	updateChan chan updateReq
	check      models.Check
	storage    *storage
	log        log.Logger
}

type updateObj struct {
	obj        runtime.Object
	updatedObj runtime.Object
}

func (u *updateObj) Preconditions() *metav1.Preconditions {
	return nil
}

func (u *updateObj) UpdatedObject(ctx context.Context, oldObj runtime.Object) (newObj runtime.Object, err error) {
	return u.updatedObj, nil
}

func newController(check models.Check) *controller {
	return &controller{
		updateChan: make(chan updateReq),
		check:      check,
		storage:    &storage{},
		log:        log.New("advisor.controller"),
	}
}

func (c *controller) SetStorage(s *storage) {
	c.storage = s
}

func (c *controller) GetChan() chan updateReq {
	return c.updateChan
}

func (c *controller) Run(ctx context.Context) {
	for {
		select {
		case <-ctx.Done():
			return
		case req := <-c.updateChan:
			dsErrs, err := c.check.Run(context.Background(), req.obj)
			if err != nil {
				c.log.Error("Error running check", "error", err)
				return
			}

			// Store result in the status
			meta, err := utils.MetaAccessor(req.obj)
			if err != nil {
				c.log.Error("Error getting meta accessor", "error", err)
				return
			}
			err = meta.SetStatus(*dsErrs)
			if err != nil {
				c.log.Error("Error setting status", "error", err)
				return
			}

			upObj := &updateObj{
				obj:        req.obj,
				updatedObj: req.obj,
			}
			authInfo, ok := claims.From(req.ctx)
			if !ok {
				c.log.Error("Error getting claims from context")
				return
			}
			requester, err := identity.GetRequester(req.ctx)
			if err != nil {
				c.log.Error("Error getting requester", "error", err)
				return
			}

			ctx := genericapirequest.WithNamespace(context.Background(), meta.GetNamespace())
			ctx = claims.WithClaims(ctx, authInfo)
			ctx = identity.WithRequester(ctx, requester)
			res, updated, err := c.storage.Update(ctx, meta.GetName(), upObj, nil, nil, false, &metav1.UpdateOptions{})
			if err != nil {
				c.log.Error("Error updating object", "error", err)
				return
			}
			c.log.Info("Updated object", "object", res, "updated", updated)
		}
	}
}
