package jobs

import (
	"context"

	authlib "github.com/grafana/authlib/types"

	"github.com/grafana/grafana/apps/provisioning/pkg/repository"
	"github.com/grafana/grafana/pkg/services/user"
)

type AuthorResolver interface {
	ResolveAuthor(ctx context.Context, id string) (*repository.CommitSignature, error)
}

func NewUserAuthorResolver(users user.Service) AuthorResolver {
	return &userAuthorResolver{users: users}
}

type userAuthorResolver struct {
	users user.Service
}

func (r *userAuthorResolver) ResolveAuthor(ctx context.Context, id string) (*repository.CommitSignature, error) {
	t, uid, err := authlib.ParseTypeID(id)
	if err != nil {
		return nil, err
	}
	if t != authlib.TypeUser {
		return nil, nil
	}

	u, err := r.users.GetByUID(ctx, &user.GetUserByUIDQuery{UID: uid})
	if err != nil {
		return nil, err
	}

	name := u.Name
	if name == "" {
		name = u.Login
	}
	if name == "" && u.Email == "" {
		return nil, nil
	}

	return &repository.CommitSignature{Name: name, Email: u.Email}, nil
}
