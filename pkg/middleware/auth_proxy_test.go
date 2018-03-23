package middleware

import (
	"testing"
	"time"

	"github.com/grafana/grafana/pkg/login"
	m "github.com/grafana/grafana/pkg/models"
	"github.com/grafana/grafana/pkg/services/session"
	"github.com/grafana/grafana/pkg/setting"
	. "github.com/smartystreets/goconvey/convey"
	"gopkg.in/macaron.v1"
)

func TestAuthProxyWithLdapEnabled(t *testing.T) {
	Convey("When calling sync grafana user with ldap user", t, func() {

		setting.LdapEnabled = true
		setting.AuthProxyLdapSyncTtl = 60

		servers := []*login.LdapServerConf{{Host: "127.0.0.1"}}
		login.LdapCfg = login.LdapConfig{Servers: servers}
		mockLdapAuther := mockLdapAuthenticator{}

		login.NewLdapAuthenticator = func(server *login.LdapServerConf) login.ILdapAuther {
			return &mockLdapAuther
		}

		signedInUser := m.SignedInUser{}
		query := m.GetSignedInUserQuery{Result: &signedInUser}

		Convey("When session variable lastLdapSync not set, call syncSignedInUser and set lastLdapSync", func() {
			// arrange
			sess := mockSession{}
			ctx := m.ReqContext{Session: &sess}
			So(sess.Get(session.SESS_KEY_LASTLDAPSYNC), ShouldBeNil)

			// act
			syncGrafanaUserWithLdapUser(&ctx, &query)

			// assert
			So(mockLdapAuther.syncSignedInUserCalled, ShouldBeTrue)
			So(sess.Get(session.SESS_KEY_LASTLDAPSYNC), ShouldBeGreaterThan, 0)
		})

		Convey("When session variable not expired, don't sync and don't change session var", func() {
			// arrange
			sess := mockSession{}
			ctx := m.ReqContext{Session: &sess}
			now := time.Now().Unix()
			sess.Set(session.SESS_KEY_LASTLDAPSYNC, now)

			// act
			syncGrafanaUserWithLdapUser(&ctx, &query)

			// assert
			So(sess.Get(session.SESS_KEY_LASTLDAPSYNC), ShouldEqual, now)
			So(mockLdapAuther.syncSignedInUserCalled, ShouldBeFalse)
		})

		Convey("When lastldapsync is expired, session variable should be updated", func() {
			// arrange
			sess := mockSession{}
			ctx := m.ReqContext{Session: &sess}
			expiredTime := time.Now().Add(time.Duration(-120) * time.Minute).Unix()
			sess.Set(session.SESS_KEY_LASTLDAPSYNC, expiredTime)

			// act
			syncGrafanaUserWithLdapUser(&ctx, &query)

			// assert
			So(sess.Get(session.SESS_KEY_LASTLDAPSYNC), ShouldBeGreaterThan, expiredTime)
			So(mockLdapAuther.syncSignedInUserCalled, ShouldBeTrue)
		})
	})
}

type mockSession struct {
	value interface{}
}

func (s *mockSession) Start(c *macaron.Context) error {
	return nil
}

func (s *mockSession) Set(k interface{}, v interface{}) error {
	s.value = v
	return nil
}

func (s *mockSession) Get(k interface{}) interface{} {
	return s.value
}

func (s *mockSession) Delete(k interface{}) interface{} {
	return nil
}

func (s *mockSession) ID() string {
	return ""
}

func (s *mockSession) Release() error {
	return nil
}

func (s *mockSession) Destory(c *macaron.Context) error {
	return nil
}

func (s *mockSession) RegenerateId(c *macaron.Context) error {
	return nil
}

type mockLdapAuthenticator struct {
	syncSignedInUserCalled bool
}

func (a *mockLdapAuthenticator) Login(query *login.LoginUserQuery) error {
	return nil
}

func (a *mockLdapAuthenticator) SyncSignedInUser(signedInUser *m.SignedInUser) error {
	a.syncSignedInUserCalled = true
	return nil
}

func (a *mockLdapAuthenticator) GetGrafanaUserFor(ldapUser *login.LdapUserInfo) (*m.User, error) {
	return nil, nil
}
func (a *mockLdapAuthenticator) SyncOrgRoles(user *m.User, ldapUser *login.LdapUserInfo) error {
	return nil
}
