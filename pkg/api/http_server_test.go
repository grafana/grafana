package api

import (
	"os"
	"testing"

	"github.com/grafana/grafana/pkg/setting"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func TestHTTPServer_MetricsBasicAuth(t *testing.T) {
	ts := &HTTPServer{
		Cfg: setting.NewCfg(),
	}

	t.Run("enabled", func(t *testing.T) {
		ts.Cfg.MetricsEndpointBasicAuthUsername = "foo"
		ts.Cfg.MetricsEndpointBasicAuthPassword = "bar"

		assert.True(t, ts.metricsEndpointBasicAuthEnabled())
	})

	t.Run("disabled", func(t *testing.T) {
		ts.Cfg.MetricsEndpointBasicAuthUsername = ""
		ts.Cfg.MetricsEndpointBasicAuthPassword = ""

		assert.False(t, ts.metricsEndpointBasicAuthEnabled())
	})
}

func TestHTTPServer_readCertificates(t *testing.T) {
	ts := &HTTPServer{
		Cfg: setting.NewCfg(),
	}
	t.Run("ReadCertificates should return error when cert files are not configured", func(t *testing.T) {
		_, err := ts.readCertificates()
		assert.NotNil(t, err)
	})
}

func TestHTTPServer_readEncryptedCertificates(t *testing.T) {
	t.Run("readCertificates should return certificate if configuration is correct", func(t *testing.T) {
		cfg, cleanUpFunc := getHttpServerCfg(t)
		defer cleanUpFunc()

		ts := &HTTPServer{
			Cfg: cfg,
		}

		c, err := ts.readCertificates()
		require.Nil(t, err)
		require.NotNil(t, c)
	})

	t.Run("readCertificates should return error if the password provided is not the correct one", func(t *testing.T) {
		cfg, cleanUpFunc := getHttpServerCfg(t)
		defer cleanUpFunc()
		// change for a wrong password - 32char for consistency
		cfg.CertPassword = "somethingThatIsNotTheCorrectPass"

		ts := &HTTPServer{
			Cfg: cfg,
		}

		c, err := ts.readCertificates()
		require.Nil(t, c)
		require.NotNil(t, err)
		require.Equal(t, err.Error(), "error parsing PKCS8 Private key: pkcs8: incorrect password")
	})
}

// returns Cfg and cleanup function for the created files
func getHttpServerCfg(t *testing.T) (*setting.Cfg, func()) {
	// create cert files
	cert, err := os.CreateTemp("", "certWithPass*.crt")
	require.NoError(t, err)
	_, err = cert.Write(certWithPass)
	require.NoError(t, err)

	privateKey, err := os.CreateTemp("", "privateKey*.key")
	require.NoError(t, err)
	_, err = privateKey.Write(privateKeyWithPass)
	require.NoError(t, err)

	cfg := setting.NewCfg()
	cfg.CertPassword = password
	cfg.CertFile = cert.Name()
	cfg.KeyFile = privateKey.Name()
	cfg.Protocol = "https"

	cleanupFunc := func() {
		_ = os.Remove(cert.Name())
		_ = os.Remove(privateKey.Name())
	}

	return cfg, cleanupFunc
}

/*
*	Certificates encrypted with password used for testing. These are valid until Aug 1st 2027.
*	To generate new ones, use this commands:
*
*	# Generate RSA private key with a passphrase '12345678901234567890123456789012'
*   sudo openssl genrsa -aes256 -passout pass:12345678901234567890123456789012 -out ./grafana_pass.key 2048
*   # Create a new Certificate Signing Request (CSR) using the private key passing passphrase '12345678901234567890123456789012'
*   sudo openssl req -new -nodes -sha256 -key ./grafana_pass.key -subj '/CN=testCertWithPass/C=us' -passin pass:12345678901234567890123456789012 -out ./grafana_pass.csr
*   # Sign the CSR using the private key to create a self-signed certificate valid for 365 days
*   sudo openssl x509 -req -days 1095 -in ./grafana_pass.csr -signkey ./grafana_pass.key -passin pass:12345678901234567890123456789012 -out ./grafana_pass.crt
 */
var certWithPass = []byte(`-----BEGIN CERTIFICATE-----
MIIC1zCCAb8CFGUb9G3+Dl7bTJgCsV0HatdD6jnkMA0GCSqGSIb3DQEBCwUAMCgx
GTAXBgNVBAMMEHRlc3RDZXJ0V2l0aFBhc3MxCzAJBgNVBAYTAnVzMB4XDTI0MDgw
MTE4MzM0OFoXDTI3MDgwMTE4MzM0OFowKDEZMBcGA1UEAwwQdGVzdENlcnRXaXRo
UGFzczELMAkGA1UEBhMCdXMwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIB
AQCKnZHWYZLgfpV2MqhTHxpONwQ6dUWWwAl3sQaLV2VH6e0qBhCaO4gCKQbv3KeH
4sXmdYG4fKJ+SnwGhljfW4anQjb/puVSX8E4EXwf81DBUKbUGs5GvIx6oIx2HkoO
BoKBNgsk8K/Eq4XcVUo8PfxbsJzoCyxcrjelV4UDgxpwDCTaewmiIUb+V/JvQi65
J1EWWofghKkNwhZ0Qyh6I9O8N7ZbkEUSbATcZ32AoDhpzhbVXQkNhJJV5SSa2zaA
Bv50cni9Te4PEYq97xUkq2KaD3c+Ie1VrAAmJVCgcUylG1YeZUohyaLbY7DG/PaW
ZPu6OqKddfH1UxUG0xzRjbmJAgMBAAEwDQYJKoZIhvcNAQELBQADggEBAEZXVWWV
GdaSUuBlc9Rd6DvSQSBYzBm5zfoQlw1IQT93tI4SVD2U04RPfxUdCh6QxsssitRn
tz2x3EKFBQ3x0jYk+JHxBLdTWAhdWrhFB+beUuOUQ5++cBDTHvpyoROAg/cIz4Fg
PvdhneOlQBe7Vh1Uv4ez+H7U1MtgUAt2LYhb5hundhUpH/WCsn1mlehyhrbDBzPc
f9JeTlZbe6wyvS/26qGPSCgP0KNvltR0Cjf2AV2gjX/7+BUr9qFBRjs4+jZkIRkP
fsYk656OSlFMbYlst1ktnBrmBE7AOHdW/WRynfIFQACNkwnrnPO1u8ZRSUzVlg/2
lzZlmPUgKBVA0kA=
-----END CERTIFICATE-----`)

var privateKeyWithPass = []byte(`-----BEGIN ENCRYPTED PRIVATE KEY-----
MIIFLTBXBgkqhkiG9w0BBQ0wSjApBgkqhkiG9w0BBQwwHAQIpLpJYDO3y4wCAggA
MAwGCCqGSIb3DQIJBQAwHQYJYIZIAWUDBAEqBBAx2HkCNR7WRCmF3QiOqhRzBIIE
0O40A8q91zh6j2bseuIMGUQNEeRSf46fUUqtucgV/KAgpQMHL0/tTfhS5GaRcBlm
vry+9Yzfy2So5/SzC6eljdLzOuKHthgn8bBlNb8Z6atmcftr1Geeaw7lXhQqfIj7
qVWQZuU+idSPR3QqKHCpubso4ydyANxDeAuylkdHix9LZFH8oYeJZB48o1adkjVG
nrPuupH/Rm6P7oC8E5x1lMcaAt3DFUaojycXFhGl6vnaejC6oMQqJ58KkHnNrLe+
ltwNCphH35rDGY6mS6a7xMHEfuFHS0bg1Tl5N+vspDg99lFBL92pwdHp8hsoS8Pl
jh4nzsNc0BUQOzDcxh8uHbyAbH8jC7rLs6DUxswSJEE+tDfsKtAu6dcMsbobETTQ
+OIQ0mi2uOQ0G/Fmflf6wPPnWJpWZI/ivHmK4Gmakp+ZSFCyROekO4a5K7J5KbWM
dmv9qFbm0LacQpT/XrS+m1TKNLd1udiJpXULmmWisQTxyorjw84WAvOlaVt1ilSQ
vSYSc1dOvdZO8G0PWa0EoDOIXDohAFeHy+tfBQ/gxSWj2SyC8wpFibchjT9FrMwI
S5NRUmbjHLiIBcHQYhE+ICP238H7v4JaE2LRhljWESRb5eNlD6Ybf0h8WzEjLWmz
RJMNedHnUFV/S1eph3BXUMt+3EKYcAqs+xB80Bi/QgyRBrghlolQS55p3gOyZu8w
NCJ+qsHtFJIaZHDPgD7JOvG8E5Jy8NoFf6qsqROEkVZY3AP9XdK4vx/tn8bSIijX
oTZ04nzud1TKNBaow5/AoyTlPZvToN1IUPXHhpcpvDlz4IvTTL3Owb+//eHphwhS
tbkJyFg7PWQSpL8HcX4zFizmlqhq+hVlPrddlAmR45AL3U10J2TTHyNBo1Lvy9YS
jSe3Ux+gIk30oPRzoVNOXLnACt25LljZ28usuuXTiL2EXL/E7to0z5srOSFpwcZX
0hkokKKqYwjEvGVolfEB9wSxJ9SsapFj+GrEnKdjZacm4rxmzDGaHwKOm/Rbwg2b
XCl3LKFiyJPL0rssMvv6qgelkBzbRwjctXjEa8SIR6s1nOumP2QlYHT1Di66k0+E
zAYm0FNSo2OleRR6pbbXZJXbkUDU931JnON2OPvZ7UhHM2hWfAQq5Nl2KcaqKx/C
eiRV8o8qOuXyNnckWtv7btFj8Y+MLMIt+Ee6ZWeUWQKEFUoGInPUj8KAN8w8K3Z7
BX1JyIJD/qNV9mgKFjmhCI3m2xox5b+RO1NDsDz3S33hsPdBHJHWwBCZLquwq+mM
aSiWiFL8KCK6Fc478J6iUg7Jzd8z3TC02VhCc4p+xWTYEgQN8yUxV2rxSk9mwsWq
v/iOCp07NN9uhNbF4KIrIX010sUYIq8iI1QeiFtQgmooBUHvd3RQH5fLaa5hwozt
hmVfJ7Wl0aBpD516QC09QhQS0jqnFRr433dVRI6zFNdxw3joZPUp4MKBlJ7g0CJV
Iv0fKNJwfT7Vmmwu2M3T5O0NzNx6VkGYXei5+NaJvUwXNwUzmdBUieXyP1bHMhr9
cobRX9pYWflHCH4n0PshBo/quh98Omy7MVcSQtP4S2kQ4uYtZV8pZj1L5K9DekK0
Fx113Ns6T2LzzdARMN7S3qsiRveFRrz+Xm0Rtrl//KB5
-----END ENCRYPTED PRIVATE KEY-----
`)
var password = "12345678901234567890123456789012"
