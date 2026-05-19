package fakes

import (
	"context"

	"github.com/grafana/grafana/pkg/apimachinery/identity"
	"github.com/grafana/grafana/pkg/services/ngalert/models"
)

type FakeReceiverAccessService[T models.Identified] struct {
	HasListFunc                  func(context.Context, identity.Requester) (bool, error)
	FilterReadFunc               func(context.Context, identity.Requester, ...T) ([]T, error)
	AuthorizeReadFunc            func(context.Context, identity.Requester, T) error
	HasReadFunc                  func(context.Context, identity.Requester, T) (bool, error)
	FilterReadDecryptedFunc      func(context.Context, identity.Requester, ...T) ([]T, error)
	AuthorizeReadDecryptedFunc   func(context.Context, identity.Requester, T) error
	HasReadDecryptedFunc         func(context.Context, identity.Requester, T) (bool, error)
	AuthorizeUpdateFunc          func(context.Context, identity.Requester, T) error
	HasUpdateProtectedFunc       func(context.Context, identity.Requester, T) (bool, error)
	AuthorizeUpdateProtectedFunc func(context.Context, identity.Requester, T) error
	AuthorizeCreateFunc          func(context.Context, identity.Requester) error
	AuthorizeTestAllFunc         func(context.Context, identity.Requester) error
	AuthorizeTestFunc            func(context.Context, identity.Requester, T) error
	AuthorizeTestByUIDFunc       func(context.Context, identity.Requester, string) error
	AuthorizeTestNewFunc         func(context.Context, identity.Requester) error
	AuthorizeDeleteByUIDFunc     func(context.Context, identity.Requester, string) error
	AuthorizeReadByUIDFunc       func(context.Context, identity.Requester, string) error
	AuthorizeUpdateByUIDFunc     func(context.Context, identity.Requester, string) error
	AuthorizeReadSomeFunc        func(context.Context, identity.Requester) error
	AccessFunc                   func(context.Context, identity.Requester, ...T) (map[string]models.ReceiverPermissionSet, error)

	Calls Calls
}

func (s *FakeReceiverAccessService[T]) Reset() {
	s.Calls = Calls{}
	s.HasListFunc = nil
	s.FilterReadFunc = nil
	s.AuthorizeReadFunc = nil
	s.HasReadFunc = nil
	s.FilterReadDecryptedFunc = nil
	s.AuthorizeReadDecryptedFunc = nil
	s.HasReadDecryptedFunc = nil
	s.AuthorizeUpdateFunc = nil
	s.HasUpdateProtectedFunc = nil
	s.AuthorizeUpdateProtectedFunc = nil
	s.AuthorizeCreateFunc = nil
	s.AuthorizeTestAllFunc = nil
	s.AuthorizeTestFunc = nil
	s.AuthorizeTestByUIDFunc = nil
	s.AuthorizeTestNewFunc = nil
	s.AuthorizeDeleteByUIDFunc = nil
	s.AuthorizeReadByUIDFunc = nil
	s.AuthorizeUpdateByUIDFunc = nil
	s.AuthorizeReadSomeFunc = nil
	s.AccessFunc = nil
}

func (s *FakeReceiverAccessService[T]) HasList(ctx context.Context, user identity.Requester) (bool, error) {
	s.Calls = append(s.Calls, Call{"HasList", []interface{}{ctx, user}})
	if s.HasListFunc != nil {
		return s.HasListFunc(ctx, user)
	}
	return true, nil
}

func (s *FakeReceiverAccessService[T]) FilterRead(ctx context.Context, user identity.Requester, receivers ...T) ([]T, error) {
	s.Calls = append(s.Calls, Call{"FilterRead", []interface{}{ctx, user, receivers}})
	if s.FilterReadFunc != nil {
		return s.FilterReadFunc(ctx, user, receivers...)
	}
	return receivers, nil
}

func (s *FakeReceiverAccessService[T]) AuthorizeRead(ctx context.Context, user identity.Requester, receiver T) error {
	s.Calls = append(s.Calls, Call{"AuthorizeRead", []interface{}{ctx, user, receiver}})
	if s.AuthorizeReadFunc != nil {
		return s.AuthorizeReadFunc(ctx, user, receiver)
	}
	return nil
}

func (s *FakeReceiverAccessService[T]) HasRead(ctx context.Context, user identity.Requester, receiver T) (bool, error) {
	s.Calls = append(s.Calls, Call{"HasRead", []interface{}{ctx, user, receiver}})
	if s.HasReadFunc != nil {
		return s.HasReadFunc(ctx, user, receiver)
	}
	return true, nil
}

func (s *FakeReceiverAccessService[T]) FilterReadDecrypted(ctx context.Context, user identity.Requester, receivers ...T) ([]T, error) {
	s.Calls = append(s.Calls, Call{"FilterReadDecrypted", []interface{}{ctx, user, receivers}})
	if s.FilterReadDecryptedFunc != nil {
		return s.FilterReadDecryptedFunc(ctx, user, receivers...)
	}
	return receivers, nil
}

func (s *FakeReceiverAccessService[T]) AuthorizeReadDecrypted(ctx context.Context, user identity.Requester, receiver T) error {
	s.Calls = append(s.Calls, Call{"AuthorizeReadDecrypted", []interface{}{ctx, user, receiver}})
	if s.AuthorizeReadDecryptedFunc != nil {
		return s.AuthorizeReadDecryptedFunc(ctx, user, receiver)
	}
	return nil
}

func (s *FakeReceiverAccessService[T]) HasReadDecrypted(ctx context.Context, user identity.Requester, receiver T) (bool, error) {
	s.Calls = append(s.Calls, Call{"HasReadDecrypted", []interface{}{ctx, user, receiver}})
	if s.HasReadDecryptedFunc != nil {
		return s.HasReadDecryptedFunc(ctx, user, receiver)
	}
	return true, nil
}

func (s *FakeReceiverAccessService[T]) AuthorizeUpdate(ctx context.Context, user identity.Requester, receiver T) error {
	s.Calls = append(s.Calls, Call{"AuthorizeUpdate", []interface{}{ctx, user, receiver}})
	if s.AuthorizeUpdateFunc != nil {
		return s.AuthorizeUpdateFunc(ctx, user, receiver)
	}
	return nil
}

func (s *FakeReceiverAccessService[T]) HasUpdateProtected(ctx context.Context, user identity.Requester, receiver T) (bool, error) {
	s.Calls = append(s.Calls, Call{"HasUpdateProtected", []interface{}{ctx, user, receiver}})
	if s.HasUpdateProtectedFunc != nil {
		return s.HasUpdateProtectedFunc(ctx, user, receiver)
	}
	return true, nil
}

func (s *FakeReceiverAccessService[T]) AuthorizeUpdateProtected(ctx context.Context, user identity.Requester, receiver T) error {
	s.Calls = append(s.Calls, Call{"AuthorizeUpdateProtected", []interface{}{ctx, user, receiver}})
	if s.AuthorizeUpdateProtectedFunc != nil {
		return s.AuthorizeUpdateProtectedFunc(ctx, user, receiver)
	}
	return nil
}

func (s *FakeReceiverAccessService[T]) AuthorizeCreate(ctx context.Context, user identity.Requester) error {
	s.Calls = append(s.Calls, Call{"AuthorizeCreate", []interface{}{ctx, user}})
	if s.AuthorizeCreateFunc != nil {
		return s.AuthorizeCreateFunc(ctx, user)
	}
	return nil
}

func (s *FakeReceiverAccessService[T]) AuthorizeTestAll(ctx context.Context, user identity.Requester) error {
	s.Calls = append(s.Calls, Call{"AuthorizeTestAll", []interface{}{ctx, user}})
	if s.AuthorizeTestAllFunc != nil {
		return s.AuthorizeTestAllFunc(ctx, user)
	}
	return nil
}

func (s *FakeReceiverAccessService[T]) AuthorizeTest(ctx context.Context, user identity.Requester, receiver T) error {
	s.Calls = append(s.Calls, Call{"AuthorizeTest", []interface{}{ctx, user, receiver}})
	if s.AuthorizeTestFunc != nil {
		return s.AuthorizeTestFunc(ctx, user, receiver)
	}
	return nil
}

func (s *FakeReceiverAccessService[T]) AuthorizeTestByUID(ctx context.Context, user identity.Requester, uid string) error {
	s.Calls = append(s.Calls, Call{"AuthorizeTestByUID", []interface{}{ctx, user, uid}})
	if s.AuthorizeTestByUIDFunc != nil {
		return s.AuthorizeTestByUIDFunc(ctx, user, uid)
	}
	return nil
}

func (s *FakeReceiverAccessService[T]) AuthorizeTestNew(ctx context.Context, user identity.Requester) error {
	s.Calls = append(s.Calls, Call{"AuthorizeTestNew", []interface{}{ctx, user}})
	if s.AuthorizeTestNewFunc != nil {
		return s.AuthorizeTestNewFunc(ctx, user)
	}
	return nil
}

func (s *FakeReceiverAccessService[T]) AuthorizeDeleteByUID(ctx context.Context, user identity.Requester, uid string) error {
	s.Calls = append(s.Calls, Call{"AuthorizeDeleteByUID", []interface{}{ctx, user, uid}})
	if s.AuthorizeDeleteByUIDFunc != nil {
		return s.AuthorizeDeleteByUIDFunc(ctx, user, uid)
	}
	return nil
}

func (s *FakeReceiverAccessService[T]) AuthorizeReadByUID(ctx context.Context, user identity.Requester, uid string) error {
	s.Calls = append(s.Calls, Call{"AuthorizeReadByUID", []interface{}{ctx, user, uid}})
	if s.AuthorizeReadByUIDFunc != nil {
		return s.AuthorizeReadByUIDFunc(ctx, user, uid)
	}
	return nil
}

func (s *FakeReceiverAccessService[T]) AuthorizeUpdateByUID(ctx context.Context, user identity.Requester, uid string) error {
	s.Calls = append(s.Calls, Call{"AuthorizeUpdateByUID", []interface{}{ctx, user, uid}})
	if s.AuthorizeUpdateByUIDFunc != nil {
		return s.AuthorizeUpdateByUIDFunc(ctx, user, uid)
	}
	return nil
}

func (s *FakeReceiverAccessService[T]) AuthorizeReadSome(ctx context.Context, user identity.Requester) error {
	s.Calls = append(s.Calls, Call{"AuthorizeReadSome", []interface{}{ctx, user}})
	if s.AuthorizeReadSomeFunc != nil {
		return s.AuthorizeReadSomeFunc(ctx, user)
	}
	return nil
}

func (s *FakeReceiverAccessService[T]) Access(ctx context.Context, user identity.Requester, receivers ...T) (map[string]models.ReceiverPermissionSet, error) {
	s.Calls = append(s.Calls, Call{"Access", []interface{}{ctx, user, receivers}})
	if s.AccessFunc != nil {
		return s.AccessFunc(ctx, user, receivers...)
	}
	return nil, nil
}
