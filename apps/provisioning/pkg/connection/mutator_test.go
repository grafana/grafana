package connection_test

import (
	"encoding/base64"
	"testing"

	provisioning "github.com/grafana/grafana/apps/provisioning/pkg/apis/provisioning/v0alpha1"
	"github.com/grafana/grafana/apps/provisioning/pkg/connection"
	common "github.com/grafana/grafana/pkg/apimachinery/apis/common/v0alpha1"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"
)

//nolint:gosec // Test RSA private key (generated for testing purposes only)
const testPrivateKeyPEM = `-----BEGIN RSA PRIVATE KEY-----
MIIEowIBAAKCAQEAoInVbLY9io2Q/wHvUIXlEHg2Qyvd8eRzBAVEJ92DS6fx9H10
06V0VRm78S0MXyo6i+n8ZAbZ0/R+GWpP2Ephxm0Gs2zo+iO2mpB19xQFI4o6ZTOw
b2WyjSaa2Vr4oyDkqti6AvfjW4VUAu932e08GkgwmmQSHXj7FX2CMWjgUwTTcuaX
65SHNKLNYLUP0HTumLzoZeqDTdoMMpKNdgH9Avr4/8vkVJ0mD6rqvxnw3JHsseNO
WdQTxf2aApBNHIIKxWZ2i/ZmjLNey7kltgjEquGiBdJvip3fHhH5XHdkrXcjRtnw
OJDnDmi5lQwv5yUBOSkbvbXRv/L/m0YLoD/fbwIDAQABAoIBAFfl//hM8/cnuesV
+R1Con/ZAgTXQOdPqPXbmEyniVrkMqMmCdBUOBTcST4s5yg36+RtkeaGpb/ajyyF
PAB2AYDucwvMpudGpJWOYTiOOp4R8hU1LvZfXVrRd1lo6NgQi4NLtNUpOtACeVQ+
H4Yv0YemXQ47mnuOoRNMK/u3q5NoIdSahWptXBgUno8KklNpUrH3IYWaUxfBzDN3
2xsVRTn2SfTSyoDmTDdTgptJONmoK1/sV7UsgWksdFc6XyYhsFAZgOGEJrBABRvF
546dyQ0cWxuPyVXpM7CN3tqC5ssvLjElg3LicK1V6gnjpdRnnvX88d1Eh3Uc/9IM
OZInT2ECgYEA6W8sQXTWinyEwl8SDKKMbB2ApIghAcFgdRxprZE4WFxjsYNCNL70
dnSB7MRuzmxf5W77cV0N7JhH66N8HvY6Xq9olrpQ5dNttR4w8Pyv3wavDe8x7seL
5L2Xtbu7ihDr8Dk27MjiBSin3IxhBP5CJS910+pR6LrAWtEuU+FzFfECgYEAsA6y
qxHhCMXlTnauXhsnmPd1g61q7chW8kLQFYtHMLlQlgjHTW7irDZ9cPbPYDNjwRLO
7KLorcpv2NKe7rqq2ZyCm6hf1b9WnlQjo3dLpNWMu6fhy/smK8MgbRqcWpX+oTKF
79mK6hbY7o6eBzsQHBl7Z+LBNuwYmp9qOodPa18CgYEArv6ipKdcNhFGzRfMRiCN
OHederp6VACNuP2F05IsNUF9kxOdTEFirnKE++P+VU01TqA2azOhPp6iO+ohIGzi
MR06QNSH1OL9OWvasK4dggpWrRGF00VQgDgJRTnpS4WH+lxJ6pRlrAxgWpv6F24s
VAgSQr1Ejj2B+hMasdMvHWECgYBJ4uE4yhgXBnZlp4kmFV9Y4wF+cZkekaVrpn6N
jBYkbKFVVfnOlWqru3KJpgsB5I9IyAvvY68iwIKQDFSG+/AXw4dMrC0MF3DSoZ0T
TU2Br92QI7SvVod+djV1lGVp3ukt3XY4YqPZ+hywgUnw3uiz4j3YK2HLGup4ec6r
IX5DIQKBgHRLzvT3zqtlR1Oh0vv098clLwt+pGzXOxzJpxioOa5UqK13xIpFXbcg
iWUVh5YXCcuqaICUv4RLIEac5xQitk9Is/9IhP0NJ/81rHniosvdSpCeFXzxTImS
B8Uc0WUgheB4+yVKGnYpYaSOgFFI5+1BYUva/wDHLy2pWHz39Usb
-----END RSA PRIVATE KEY-----`

func TestMutateConnection(t *testing.T) {
	t.Run("should add URL to Github connection", func(t *testing.T) {
		c := &provisioning.Connection{
			ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
			Spec: provisioning.ConnectionSpec{
				Type: provisioning.GithubConnectionType,
				GitHub: &provisioning.GitHubConnectionConfig{
					AppID:          "123",
					InstallationID: "456",
				},
			},
			Secure: provisioning.ConnectionSecure{
				PrivateKey: common.InlineSecureValue{
					Name: "test-private-key",
				},
			},
		}

		require.NoError(t, connection.MutateConnection(c))
		assert.Equal(t, "https://github.com/settings/installations/456", c.Spec.URL)
	})

	t.Run("should generate JWT token when private key is provided", func(t *testing.T) {
		privateKeyBase64 := base64.StdEncoding.EncodeToString([]byte(testPrivateKeyPEM))

		c := &provisioning.Connection{
			ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
			Spec: provisioning.ConnectionSpec{
				Type: provisioning.GithubConnectionType,
				GitHub: &provisioning.GitHubConnectionConfig{
					AppID:          "123",
					InstallationID: "456",
				},
			},
			Secure: provisioning.ConnectionSecure{
				PrivateKey: common.InlineSecureValue{
					Create: common.NewSecretValue(privateKeyBase64),
				},
			},
		}

		require.NoError(t, connection.MutateConnection(c))
		assert.Equal(t, "https://github.com/settings/installations/456", c.Spec.URL)
		assert.False(t, c.Secure.Token.Create.IsZero(), "JWT token should be generated")
	})

	t.Run("should do nothing for Gitlab connection", func(t *testing.T) {
		c := &provisioning.Connection{
			ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
			Spec: provisioning.ConnectionSpec{
				Type: provisioning.GitlabConnectionType,
				Gitlab: &provisioning.GitlabConnectionConfig{
					ClientID: "clientID",
				},
			},
		}

		require.NoError(t, connection.MutateConnection(c))
	})

	t.Run("should do nothing for BitBucket connection", func(t *testing.T) {
		c := &provisioning.Connection{
			ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
			Spec: provisioning.ConnectionSpec{
				Type: provisioning.BitbucketConnectionType,
				Bitbucket: &provisioning.BitbucketConnectionConfig{
					ClientID: "clientID",
				},
			},
		}

		require.NoError(t, connection.MutateConnection(c))
	})

	t.Run("should fail when private key is not base64", func(t *testing.T) {
		c := &provisioning.Connection{
			ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
			Spec: provisioning.ConnectionSpec{
				Type: provisioning.GithubConnectionType,
				GitHub: &provisioning.GitHubConnectionConfig{
					AppID:          "123",
					InstallationID: "456",
				},
			},
			Secure: provisioning.ConnectionSecure{
				PrivateKey: common.InlineSecureValue{
					Create: common.NewSecretValue("invalid-key"),
				},
			},
		}

		err := connection.MutateConnection(c)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to generate JWT token")
		assert.Contains(t, err.Error(), "failed to decode base64 private key")
	})

	t.Run("should fail when private key is invalid", func(t *testing.T) {
		c := &provisioning.Connection{
			ObjectMeta: metav1.ObjectMeta{Name: "test-connection"},
			Spec: provisioning.ConnectionSpec{
				Type: provisioning.GithubConnectionType,
				GitHub: &provisioning.GitHubConnectionConfig{
					AppID:          "123",
					InstallationID: "456",
				},
			},
			Secure: provisioning.ConnectionSecure{
				PrivateKey: common.InlineSecureValue{
					Create: common.NewSecretValue(base64.StdEncoding.EncodeToString([]byte("invalid-key"))),
				},
			},
		}

		err := connection.MutateConnection(c)
		require.Error(t, err)
		assert.Contains(t, err.Error(), "failed to generate JWT token")
		assert.Contains(t, err.Error(), "failed to parse private key")
	})
}
