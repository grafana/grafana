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

func TestHTTPServer_readEncryptedCertificates_PKCS8(t *testing.T) {
	t.Run("readCertificates should return certificate if configuration is correct", func(t *testing.T) {
		cfg, cleanUpFunc := getHttpServerCfg(t, certWithPassPKCS8, privateKeyWithPassPKCS8, passPKCS8)
		defer cleanUpFunc()

		ts := &HTTPServer{
			Cfg: cfg,
		}

		c, err := ts.readCertificates()
		require.Nil(t, err)
		require.NotNil(t, c)
	})

	t.Run("readCertificates should return error if the password provided is not the correct one", func(t *testing.T) {
		cfg, cleanUpFunc := getHttpServerCfg(t, certWithPassPKCS8, privateKeyWithPassPKCS8, passPKCS8)
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

func TestHTTPServer_readEncryptedCertificates_PKCS1(t *testing.T) {
	t.Run("readCertificates should return certificate if configuration is correct", func(t *testing.T) {
		cfg, cleanUpFunc := getHttpServerCfg(t, certWithPassPKCS1, privateKeyWithPassPKCS1, passPKCS1)
		defer cleanUpFunc()

		ts := &HTTPServer{
			Cfg: cfg,
		}

		c, err := ts.readCertificates()
		require.Nil(t, err)
		require.NotNil(t, c)
	})

	t.Run("readCertificates should return error if the password provided is not the correct one", func(t *testing.T) {
		cfg, cleanUpFunc := getHttpServerCfg(t, certWithPassPKCS1, privateKeyWithPassPKCS1, passPKCS1)
		defer cleanUpFunc()
		// change for a wrong password - 32char for consistency
		cfg.CertPassword = "somethingThatIsNotTheCorrectPass"

		ts := &HTTPServer{
			Cfg: cfg,
		}

		c, err := ts.readCertificates()
		require.Nil(t, c)
		require.NotNil(t, err)
		require.Equal(t, err.Error(), "error decrypting x509 PemBlock: x509: decryption password incorrect")
	})
}

// returns Cfg and cleanup function for the created files
func getHttpServerCfg(t *testing.T, cert []byte, pk []byte, pass string) (*setting.Cfg, func()) {
	// create cert files
	certFile, err := os.CreateTemp("", "certWithPass*.crt")
	require.NoError(t, err)
	_, err = certFile.Write(cert)
	require.NoError(t, err)

	privateKeyFile, err := os.CreateTemp("", "privateKeyFile*.key")
	require.NoError(t, err)
	_, err = privateKeyFile.Write(pk)
	require.NoError(t, err)

	cfg := setting.NewCfg()
	cfg.CertPassword = pass
	cfg.CertFile = certFile.Name()
	cfg.KeyFile = privateKeyFile.Name()
	cfg.Protocol = "https"

	cleanupFunc := func() {
		_ = os.Remove(certFile.Name())
		_ = os.Remove(privateKeyFile.Name())
	}

	return cfg, cleanupFunc
}

/*
* 	PKCS#8
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
var certWithPassPKCS8 = []byte(
	`-----BEGIN CERTIFICATE-----
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

var privateKeyWithPassPKCS8 = []byte(
	`-----BEGIN ENCRYPTED PRIVATE KEY-----
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
var passPKCS8 = "12345678901234567890123456789012"

/*
 * 	PKCS#1
 */
var certWithPassPKCS1 = []byte(
	`-----BEGIN CERTIFICATE-----
MIIC1zCCAb8CFDpQmlYPWV4d8WHDh0H5XcER8qUPMA0GCSqGSIb3DQEBCwUAMCgx
GTAXBgNVBAMMEHRlc3RDZXJ0V2l0aFBhc3MxCzAJBgNVBAYTAnVzMB4XDTI0MDkx
ODE3MzgwM1oXDTI1MDkxODE3MzgwM1owKDEZMBcGA1UEAwwQdGVzdENlcnRXaXRo
UGFzczELMAkGA1UEBhMCdXMwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIB
AQDFhxKDCz9NJJjKaBIjqVuyxHWomOqeMeyR0fZcWAEG7YHqYXDNqq9WJkXS8Nf+
8CEXnv5UiuVdZFGJ5I1J8ARDRQ+PgcgSIgpRPkuXtLaxdHnbkUFxSdftmtSD/kk8
nDNQ/Nqo2GcUv5MhehQpZjO/66AnoQwFO4BrGh/EVaj+myhQ4tCUZeKOQk7QXST4
lRCq5Hh3ve93lfkIbLu5bj8d8i0zrSvm67/436DeLZUI/xSkp0UFNxFfx3OGusPF
aCZpCSLJPmT7fahBkj2rr8aK0crjQRgQADfhjYG2tA3vQY7L7i2V3eV10NIk4GDv
pm5tDZZxJ2E1VZhcl/ajNQNtAgMBAAEwDQYJKoZIhvcNAQELBQADggEBALz74Cca
JP/C9v2LGOPVxw07066PgU4KRVCt+t6WlLuvm/aRIqkz7OI+1ZehluuC3GzJAxQ+
r67guBlVK1N0vQG+TbKu0LDvhfo2qtCG8dv+MruD9rIGt1N/B23HQ7MyEfCD+BwC
+gMaG5Peg2xnBYsOGBYII8f/NUK920OpjEczx9M9PQhcgiu+uUL6MZBdJDb4Hq/a
vl1POsIYgGv0YP2p0JzbFXMEhMc2nbzMvO5YgNzB/smWvcS/2qm78NKgAMA4Hfce
RxP3avOP/tPjV5vmU5zMBfJW/LmRxAs3aOXWq1/hc+B736EsKXrCzwZ6OdWqU8mX
UqsDpxqgWc0jXi4=
-----END CERTIFICATE-----
`)

var privateKeyWithPassPKCS1 = []byte(
	`-----BEGIN RSA PRIVATE KEY-----
Proc-Type: 4,ENCRYPTED
DEK-Info: AES-256-CBC,0EDAEAF0B76FFD5FB96579F514CCF82A

5MRIdfHMvBu0OkZYA6sG2CGVg6k7V5nztadc/2j875homeDV5mB3LlxU2V/4w4rm
S9TfrzHnWZ1imB3yCiLUhVE/g5BCWUJeyXAlb84NpGWEbZOaJpFFruTdGsGwMs0v
Gj+FIjECxxV0OSz2WLa4aP+awZClwEDXCsn3k5dZlTNEHZRnsqbNJBbH9UM8Acuh
W2S2Hv1Vqvlm4xoqZqnKA+IzlmbC43TWpw/gUIwDobrRuNvscO6FddTr4Px/jnd0
loHkqwm47PPHuk8L+XZua5FDB9sfYY5bk5mTZM591iBDXE+KyA/Pzyj27Pe1LFRz
buY4l+TyeStOMQaTrX1rjIhHwf0EI5k85HKyQfPFfOkb5+fbuCElKj0DqGNvVy6e
WoiYipObu8+FGrM9fad6BWIXZMI9LGiiyyX3pi/iD4+AGhOVpsIzhvWRVhkHkSBu
6QYF2+3ZbezVrjqOsRRMN60P6m1NQM4fwkY7KKJt1C+x/ejXQCXZwXaWm1jno3cH
riPsGYWNC59pGt7bi507CxLSEOoyG7tFuMEeDK9yGqW9rzffSIMW7Y3ndarxMJsd
wZEkKTZR7ZhSgcCENi4D6aNWcCrUqGbuVD1KSMyR3fuwauW0gvEDw7ydOnFvlQTJ
PNi6ZOt6oTUI2WQQBiO9u393ZBzT0mECCIcM+hI/GH5ySPolX6GYByXye2MwFsYz
gd3Qvg/Z4cuKp4ovFCkLYN/z8qefieojG2g00zd54Pk1pi559ckd1YKjZZ2IaPFJ
JGei50dnVYSOgCthbmaPm8niuPzKALeH0w5/GTxG9YzWqIzXdWCrztO3/nc2QFfr
JRcVpQrHvhLJVmXuTx50TDeHKC2iueBv1HDe87TKz+j0URxDQTb70tBYvbc8lPl7
NPWc3BzJq3qHSOqV3wQTSnKLykYXIr8T60SdMGg//v6jHdioQdMCiP9wvaFc9NLs
IYqK0zFZ43V2PcPFouqtoswyTzBKHZaXv1D8EqWMeCW9se1PwRrE789bzZ98Ul3m
6CttE8XGmkkuJmP1YrSW/nXVe2+DMnC+zvCcjMCIL8b+vwE5iUDX/Gjrrog4qg4P
/ZKVJg5r7d8oM0ZVkcFSn+66Oovm3pBWg3xnvkiPoF0mselnZ/sywrgcA9W6/hZK
X2kD08IbT3tFgwOnYkpc1ZHwscMcPzAGQEaXsZjLazUGWRq3TOpKjzrDjy/mshco
5MlCFXT2Qejtbu6iVfbP9qczwDu2Ghr+eqlIIOGBi8AqyTXwP9Vr2qHghso4rSMr
pggeKNI2v+suPaLny5QBHHCboG8tOuBi19VUFum3ZA8GqQgtbIO2w0y2EzgxB5a3
GxtCG7/wAIOugRCDAYRcKo7dwMY2zZzBYutkuJJAxMFnLo+TkJN8yW1YZZfaBGfm
UUeQdpY3dAIbqmhXFvT0vqbQ+6Jj5/hN9KQ7bC3NQ+8My4YN7PMIOeESNIEF60J0
tvFB82XZxK49N2TzFXkPZ/A/vhLaI6dFBcrrh+9keKJx1kCbbXs1Mj28Fn6555Zi
e+x4woC2+QEPY4866v34TGm+3OVywHYZYKZ/NfdM2SnI3RVn6O8FsxxvTPBU+Zqr
-----END RSA PRIVATE KEY-----

`)

var passPKCS1 = "your-password-here"
