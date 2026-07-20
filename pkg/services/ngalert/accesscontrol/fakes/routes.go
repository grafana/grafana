package fakes

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	ac "github.com/grafana/grafana/pkg/services/ngalert/accesscontrol"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

func NewDenyAllRouteAccessService[T models.Identified]() *FakeRouteAccessService[T] {
	err := ac.ErrAuthorizationBase.Errorf("access denied")
	return &FakeRouteAccessService[T]{
		FilterReadFunc: func(_ context.Context, _ identity.Requester, _ ...T) ([]T, error) {
			return nil, err
		},
		AuthorizeReadFunc: func(_ context.Context, _ identity.Requester, _ T) error {
			return err
		},
		HasReadFunc: func(_ context.Context, _ identity.Requester, _ T) (bool, error) {
			return false, err
		},
		AuthorizeReadSomeFunc: func(_ context.Context, _ identity.Requester) error {
			return err
		},
		AuthorizeReadByUIDFunc: func(_ context.Context, _ identity.Requester, _ string) error {
			return err
		},
		AuthorizeCreateFunc: func(_ context.Context, _ identity.Requester) error {
			return err
		},
		AuthorizeUpdateFunc: func(_ context.Context, _ identity.Requester, _ T) error {
			return err
		},
		AuthorizeUpdateByUIDFunc: func(_ context.Context, _ identity.Requester, _ string) error {
			return err
		},
		AuthorizeDeleteFunc: func(_ context.Context, _ identity.Requester, _ T) error {
			return err
		},
		AuthorizeDeleteByUIDFunc: func(_ context.Context, _ identity.Requester, _ string) error {
			return err
		},
		DeleteAllPermissionsFunc: func(_ context.Context, _ int64, _ T) error {
			return err
		},
		SetDefaultPermissionsFunc: func(_ context.Context, _ identity.Requester, _ T) error {
			return err
		},
		AccessFunc: func(_ context.Context, _ identity.Requester, _ ...T) (map[string]models.RoutePermissionSet, error) {
			return nil, err
		},
	}
}

type FakeRouteAccessService[T models.Identified] struct {
	FilterReadFunc            func(context.Context, identity.Requester, ...T) ([]T, error)
	AuthorizeReadFunc         func(context.Context, identity.Requester, T) error
	HasReadFunc               func(context.Context, identity.Requester, T) (bool, error)
	AuthorizeReadSomeFunc     func(context.Context, identity.Requester) error
	AuthorizeReadByUIDFunc    func(context.Context, identity.Requester, string) error
	AuthorizeCreateFunc       func(context.Context, identity.Requester) error
	AuthorizeUpdateFunc       func(context.Context, identity.Requester, T) error
	AuthorizeUpdateByUIDFunc  func(context.Context, identity.Requester, string) error
	AuthorizeDeleteFunc       func(context.Context, identity.Requester, T) error
	AuthorizeDeleteByUIDFunc  func(context.Context, identity.Requester, string) error
	DeleteAllPermissionsFunc  func(context.Context, int64, T) error
	SetDefaultPermissionsFunc func(context.Context, identity.Requester, T) error
	AccessFunc                func(context.Context, identity.Requester, ...T) (map[string]models.RoutePermissionSet, error)

	Calls Calls
}

func (s *FakeRouteAccessService[T]) FilterRead(ctx context.Context, user identity.Requester, routes ...T) ([]T, error) {
	s.Calls = append(s.Calls, Call{"FilterRead", []interface{}{ctx, user, routes}})
	if s.FilterReadFunc != nil {
		return s.FilterReadFunc(ctx, user, routes...)
	}
	return routes, nil
}

func (s *FakeRouteAccessService[T]) AuthorizeRead(ctx context.Context, user identity.Requester, route T) error {
	s.Calls = append(s.Calls, Call{"AuthorizeRead", []interface{}{ctx, user, route}})
	if s.AuthorizeReadFunc != nil {
		return s.AuthorizeReadFunc(ctx, user, route)
	}
	return nil
}

func (s *FakeRouteAccessService[T]) HasRead(ctx context.Context, user identity.Requester, route T) (bool, error) {
	s.Calls = append(s.Calls, Call{"HasRead", []interface{}{ctx, user, route}})
	if s.HasReadFunc != nil {
		return s.HasReadFunc(ctx, user, route)
	}
	return true, nil
}

func (s *FakeRouteAccessService[T]) AuthorizeReadSome(ctx context.Context, user identity.Requester) error {
	s.Calls = append(s.Calls, Call{"AuthorizeReadSome", []interface{}{ctx, user}})
	if s.AuthorizeReadSomeFunc != nil {
		return s.AuthorizeReadSomeFunc(ctx, user)
	}
	return nil
}

func (s *FakeRouteAccessService[T]) AuthorizeReadByUID(ctx context.Context, user identity.Requester, uid string) error {
	s.Calls = append(s.Calls, Call{"AuthorizeReadByUID", []interface{}{ctx, user, uid}})
	if s.AuthorizeReadByUIDFunc != nil {
		return s.AuthorizeReadByUIDFunc(ctx, user, uid)
	}
	return nil
}

func (s *FakeRouteAccessService[T]) AuthorizeCreate(ctx context.Context, user identity.Requester) error {
	s.Calls = append(s.Calls, Call{"AuthorizeCreate", []interface{}{ctx, user}})
	if s.AuthorizeCreateFunc != nil {
		return s.AuthorizeCreateFunc(ctx, user)
	}
	return nil
}

func (s *FakeRouteAccessService[T]) AuthorizeUpdate(ctx context.Context, user identity.Requester, route T) error {
	s.Calls = append(s.Calls, Call{"AuthorizeUpdate", []interface{}{ctx, user, route}})
	if s.AuthorizeUpdateFunc != nil {
		return s.AuthorizeUpdateFunc(ctx, user, route)
	}
	return nil
}

func (s *FakeRouteAccessService[T]) AuthorizeUpdateByUID(ctx context.Context, user identity.Requester, uid string) error {
	s.Calls = append(s.Calls, Call{"AuthorizeUpdateByUID", []interface{}{ctx, user, uid}})
	if s.AuthorizeUpdateByUIDFunc != nil {
		return s.AuthorizeUpdateByUIDFunc(ctx, user, uid)
	}
	return nil
}

func (s *FakeRouteAccessService[T]) AuthorizeDelete(ctx context.Context, user identity.Requester, route T) error {
	s.Calls = append(s.Calls, Call{"AuthorizeDelete", []interface{}{ctx, user, route}})
	if s.AuthorizeDeleteFunc != nil {
		return s.AuthorizeDeleteFunc(ctx, user, route)
	}
	return nil
}

func (s *FakeRouteAccessService[T]) AuthorizeDeleteByUID(ctx context.Context, user identity.Requester, uid string) error {
	s.Calls = append(s.Calls, Call{"AuthorizeDeleteByUID", []interface{}{ctx, user, uid}})
	if s.AuthorizeDeleteByUIDFunc != nil {
		return s.AuthorizeDeleteByUIDFunc(ctx, user, uid)
	}
	return nil
}

func (s *FakeRouteAccessService[T]) DeleteAllPermissions(ctx context.Context, orgID int64, route T) error {
	s.Calls = append(s.Calls, Call{"DeleteAllPermissions", []interface{}{ctx, orgID, route}})
	if s.DeleteAllPermissionsFunc != nil {
		return s.DeleteAllPermissionsFunc(ctx, orgID, route)
	}
	return nil
}

func (s *FakeRouteAccessService[T]) SetDefaultPermissions(ctx context.Context, user identity.Requester, route T) error {
	s.Calls = append(s.Calls, Call{"SetDefaultPermissions", []interface{}{ctx, user, route}})
	if s.SetDefaultPermissionsFunc != nil {
		return s.SetDefaultPermissionsFunc(ctx, user, route)
	}
	return nil
}

func (s *FakeRouteAccessService[T]) Access(ctx context.Context, user identity.Requester, routes ...T) (map[string]models.RoutePermissionSet, error) {
	s.Calls = append(s.Calls, Call{"Access", []interface{}{ctx, user, routes}})
	if s.AccessFunc != nil {
		return s.AccessFunc(ctx, user, routes...)
	}
	return nil, nil
}
