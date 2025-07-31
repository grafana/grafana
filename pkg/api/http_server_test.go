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
		Cfg: setting.ProvideService(setting.NewCfg()),
	}

	cfg := ts.Cfg.Get()
	t.Run("enabled", func(t *testing.T) {
		cfg.MetricsEndpointBasicAuthUsername = "foo"
		cfg.MetricsEndpointBasicAuthPassword = "bar"

		assert.True(t, ts.metricsEndpointBasicAuthEnabled())
	})

	t.Run("disabled", func(t *testing.T) {
		cfg.MetricsEndpointBasicAuthUsername = ""
		cfg.MetricsEndpointBasicAuthPassword = ""

		assert.False(t, ts.metricsEndpointBasicAuthEnabled())
	})
}

func TestHTTPServer_readCertificates(t *testing.T) {
	ts := &HTTPServer{
		Cfg: setting.ProvideService(setting.NewCfg()),
	}
	t.Run("ReadCertificates should return error when cert files are not configured", func(t *testing.T) {
		_, err := ts.readCertificates()
		assert.NotNil(t, err)
		assert.Equal(t, "cert_file cannot be empty when using HTTPS", err.Error())
	})
}

func TestHTTPServer_readEncryptedCertificates(t *testing.T) {
	type testCase struct {
		desc        string
		primaryKey  []byte
		cert        []byte
		pass        string
		expectedErr string
	}

	tests := []testCase{
		{
			desc:       "readCertificates should return certificate if configuration is correct - PKCS#8 with password",
			primaryKey: privateKeyWithPassPKCS8,
			cert:       certWithPassPKCS8,
			pass:       passPKCS8,
		},
		{
			desc:       "readCertificates should return certificate if configuration is correct - PKCS#1 with password",
			primaryKey: privateKeyWithPassPKCS1,
			cert:       certWithPassPKCS1,
			pass:       passPKCS1,
		},
		{
			desc:       "readCertificates should return certificate if configuration is correct - No pass",
			primaryKey: privateKeyNoPass,
			cert:       certNoPass,
			pass:       "",
		},
		{
			desc:        "readCertificates should return error if the password provided is not the correct one - PKCS#8 with password",
			primaryKey:  privateKeyWithPassPKCS8,
			cert:        certWithPassPKCS8,
			pass:        "somethingThatIsNotTheCorrectPass",
			expectedErr: "error parsing PKCS8 Private key: pkcs8: incorrect password",
		},
		{
			desc:        "readCertificates should return error if the password provided is not the correct one - PKCS#1 with password",
			primaryKey:  privateKeyWithPassPKCS1,
			cert:        certWithPassPKCS1,
			pass:        "somethingThatIsNotTheCorrectPass2",
			expectedErr: "error decrypting x509 PemBlock: x509: decryption password incorrect",
		},
	}

	for _, tt := range tests {
		t.Run(tt.desc, func(t *testing.T) {
			cfg, cleanUpFunc := getHttpServerCfg(t, tt.cert, tt.primaryKey, tt.pass)
			defer cleanUpFunc()

			ts := &HTTPServer{
				Cfg: setting.ProvideService(cfg),
			}

			c, err := ts.readCertificates()
			if tt.expectedErr == "" {
				require.Nil(t, err)
				require.NotNil(t, c)
			} else {
				require.Nil(t, c)
				require.NotNil(t, err)
				require.Equal(t, tt.expectedErr, err.Error())
			}
		})
	}
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
 *  openssl genrsa -aes256 -passout pass:12345678901234567890123456789012 -out ./grafana_pass.key 2048
 *  # Create a new Certificate Signing Request (CSR) using the private key passing passphrase '12345678901234567890123456789012'
 *  openssl req -new -nodes -sha256 -key ./grafana_pass.key -subj '/CN=testCertWithPass/C=us' -passin pass:12345678901234567890123456789012 -out ./grafana_pass.csr
 *  # Sign the CSR using the private key to create a self-signed certificate valid for 1095 days
 *  openssl x509 -req -days 1095 -in ./grafana_pass.csr -signkey ./grafana_pass.key -passin pass:12345678901234567890123456789012 -out ./grafana_pass.crt
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
 * PKCS#1
 * Certificates encrypted with password used for testing. These are valid until Sept 19th 2027.
 * To generate new ones, use this commands:
 *
 * # Generate RSA private key with a passphrase '111112222233333444445555566666612'.
 * # The -traditional flag explicitly forces the use of the PKCS#1 format for RSA private keys. This is needed for newer versions of openssl
 * openssl genrsa -traditional -aes256 -passout pass:111112222233333444445555566666612 -out encrypted_rsa_key.pem  2048
 * # Create a new Certificate Signing Request (CSR) using the private key passing passphrase '111112222233333444445555566666612'
 * openssl req -new -nodes -sha256 -key encrypted_rsa_key.pem -subj '/CN=testCertWithPass/C=us' -passin pass:111112222233333444445555566666612 -out certificate_request.csr
 * # Sign the CSR using the private key to create a self-signed certificate valid for 1095 days
 * openssl x509 -req -days 1095 -in certificate_request.csr -signkey encrypted_rsa_key.pem -passin pass:111112222233333444445555566666612 -out certificate.crt
 */
var certWithPassPKCS1 = []byte(
	`-----BEGIN CERTIFICATE-----
MIIC1zCCAb8CFGKBaDfnasNQFzOg7QR1Tm1vmQZ2MA0GCSqGSIb3DQEBCwUAMCgx
GTAXBgNVBAMMEHRlc3RDZXJ0V2l0aFBhc3MxCzAJBgNVBAYTAnVzMB4XDTI0MDkx
OTEyMDgyOVoXDTI3MDkxOTEyMDgyOVowKDEZMBcGA1UEAwwQdGVzdENlcnRXaXRo
UGFzczELMAkGA1UEBhMCdXMwggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAwggEKAoIB
AQDGvaV1ROGZqNghVK4kjgME4joT32oe66nfYum4OiKJQPBA80umYiD++f/sglSl
Nj+LIuus0EvXUFsweTJXW7CdECSlxXpzwXYuN9YncGjsX0Oywn/CMgXybVLZyOaX
RiYB5X/pEJIWX7ywPtOS5gW1lIzuKnpyELh0EkI3oatMn7bdBcwg8kIuwJHdtF6D
rqvrsDDfo4o9XqQfQZ2m+WXd22f1qcRR5svILzq16WT1d/6+JvVCypv2TmzNCuEZ
SfDdwVyRGw2N8RVl9HdtTaIByFnusaYX7qbf6LfCcrKPDAnb8f1uYtJYYLDmQK3x
JuFbtk47Qm2mh3JEWEIzwom/AgMBAAEwDQYJKoZIhvcNAQELBQADggEBADCAUlFN
hv1t7RDB7nq9ow6Shu0VFxooP1ekeN6FuNthvG0tVI/APoetlyIwUr5Fp4Rhj9J3
J6hnCsMARJAgDiCFya9NleG2PATzrLHm4DJL0zm005pZOtmfxDOeCt+/lDIGU+Rg
fktYtY5Iuh4RD9UBt2COlUM9K9WuwFjgQhzspKfNys5Nm0l+3Oh4/F8XLjL15tEw
mV+maFncQ2F1Yo5LJ4nGcF52z6v4Z5sk5lVBYuaO3S8d1ZrBgTyx5gZ8zI5+ewhH
rTNsasDlsoXKws8yZWSGEOkldYwmMwpdEkbVoNuUbhmgL2v17gx9l8iBcVo+agn1
KjQqJMB7C49JJ2w=
-----END CERTIFICATE-----`)

var privateKeyWithPassPKCS1 = []byte(
	`-----BEGIN RSA PRIVATE KEY-----
Proc-Type: 4,ENCRYPTED
DEK-Info: AES-256-CBC,BFA318F0BA852F1D507C1FF646BD9E41

E4UOCP1+oDxm36pqaI1AqSrl4vykLE0x4tN5P0uJgwCQ6CWN0ZiAxJYtXE4MxGIq
eLk5L5GL/oeziFPT464Cxt01TdNjL57CwAuMw7ucS+/WV56Y5370FBNXkLQTUBkV
GKXpqtE3T7VHwltNAddJPX9sQMqC/jgpMQBCwlg6KPfvs74acE75jyjSr7za0ozR
jDUfY5dVROU7pgjwanz0K26joaBE9PUGlbQoN3HoIAQOl85GMJaeaXoPgJiY2Txm
oTWqhDqY52Gj8n7vqpJyykIYaw0jHwCv1QR/fWN0BT7/aRQbM1xXwmGkCurm1BTI
Gh4tq9iDs+cXj08DLxJ2QZ9c/kkcBtaiBW6W7Cm1VEMMAFKYnTvw2o6oBkfcy5qD
fHVxA7x4MQJCXewt7T9ONq2MMfCQYE/y0RWD7nEOEnSa0rCGmlQnyi0poEtw97MQ
itB5RO5OuhoGqYnaPPnX///xr0Lzc5xqtXQLGNXRvRpl7MUCgeD6gOc8whEdUWUq
rGHAXEBSyfX+TWV2XlrzlH1s+gZ3kX65Gp5xuV66QSekLfyznKLuTarHZUUEOIAM
/78PF9GcNd7NKWtTieAfu4Rz9OWVXe4M8x3KDmYc3n7sR4ZhO2tBMNzvgI5KWuW0
o1AxJR3zOjDDeiz7undrmCFwh08VF+ZVNdBSDCXIYsjdD0BzfrliwqL6hn3Od1MW
71xZBuQoXBgDM+MOvtHa5fGsBgny6ehHc6V9/fjdPMe/zmWLqDn7mRgcmRtP8u2c
egZf0EfPqR+4iy7UtzOpdh5TI4r/rlKstOMU+lbVzoIv3Jh1oUw/fBbOFVteks3L
jR7rTFdfJgr/dsnjd/PbMfcrOIDr6OkvST+RUiyBcgOC6snaPrPrL3+6kPtEiYVE
Hmaw8TfH5AQ8mx+xDiabhnKduX5POUEN17sw40O0jIJmHQ5KDrawYzz24ZBxOsVC
0RLExLJwXtUYZ4fUfVtyOMLGKYHqZnz1XzmHJ1m7/rpd6ccYzFAK9+SO7zEs7mRH
iVC+4lOsU4lfrhFIDVkFvtTBPTneF+2oHQu5psm55/Hnm0VqDzrcXPapTZQznwVZ
HRBsiahLaHzF1zF+xQPm3PspcEm1wQNp1EEW4QlZYQyg16dAt813i0JDL8MWQR/U
aunhNyI0w6/rE7kEeT/3iFUqdJQkAXoRRQLg5urwTZJlhV32/5MG5ADr+k/e7LQe
s2yUbEa0P0hrN0ACPl4RsmE10GFoPuJjcYyANd+UvZPRTrfJMWT8M3Ggv7qfgZmH
uLJ5pi/xIH/bYAWf5B/mH+7z6T40x2z8N5sHiVBsK2iYRxNFpAKzVaOJmXyAxCTu
MadzTUuqiXXr7pnmA8oKcJ80fcpAGtSw+QaQWIqJySo68MtSYg0RdljMYJ1mV/QD
HhSeh4jdv3uSdb2TvpXkxnmmNnKyqhiqCWvAzG7GiMvZ0VnPvfcZUBYiGBfS49oY
Igxrr1ibkqVn987DaBb6F77FfV0YDicn/mpTVbVdkeh1LAOwisqgWIRbkI4Vwk3q
nGUA2Etz9Oq9imNLu4Sb96r9I0WfQDKvsgxK2dhRwb9fg6kZ7y6Nb6XzqU3XJs44
-----END RSA PRIVATE KEY-----`)

var passPKCS1 = "111112222233333444445555566666612"

/**
 * Certificates without password used for testing. These are valid until Sept 19th 2027.
 * To generate new ones, use this commands:
 *
 * # Generate RSA private key
 * openssl genrsa -out ./grafana_no_pass.key 2048
 * # Create a new Certificate Signing Request (CSR) using the private key
 * openssl req -new -key ./grafana_no_pass.key -subj '/CN=testCertWithoutPass/C=SK' -out ./grafana_no_pass.csr
 * # Sign the CSR using the private key to create a self-signed certificate valid for 365 days
 * openssl x509 -req -days 1095 -in ./grafana_no_pass.csr -signkey ./grafana_no_pass.key -out ./grafana_no_pass.crt
 */

var privateKeyNoPass = []byte(
	`-----BEGIN PRIVATE KEY-----
MIIEvgIBADANBgkqhkiG9w0BAQEFAASCBKgwggSkAgEAAoIBAQCiCb+D7DddLgsU
TP4wu6B4fvFqmYbMH9O+mvP6iwAS2jazOrw2Was8+AKafxnSM1TrbPgH3nUS6TzM
iSrisDgPUuZ/MxvSFG2VFNhB/vujteI6tyXZdNpiptvxJumHvPR4Qjc9wrCYl3qh
x6T/KkKVkBEXi0+frWUJw0xFNiKu8Rdgo4ceZ3kHZt/ZqESDf26v18clQETBB7oR
WzPmuktnCyX2WPN/B2DWl9eDNMUtQt8HzA8XhOL5nFYUYXOKmFSprD29JaeeKCrF
YkIDfLq+k2lzxo1Btur6u1gJyOOi5X1hfoGgZNINNnWeuw0iuqX2Wgw9HjfBV1hS
ACzeUJiVAgMBAAECggEABfQlvUsonZvbfFt324KJWuQPKsOJWGay+QXogQQqdIbg
C6XU1Ipm6E6Uieixoi+QpzXRxzg9RPyc50cC9GFVLfr1zSarlwR5IkkpyQL9a/56
2X1xPpQ0kftfiXTMj9g5g1GrhfFpW7H1J4yWW2nKGIS6nAraWhuc4sbyPnjGvXa/
Pgdd1mW+bCd++qh0bsUZSosPZSc8xv/2rEA7eqa+mbADC/Cjf6OJl2lKXypJhRqg
5wUCcYDzCPCXa0H1qcJK+9KrcejgFqUg0lC4LPEQtJfvxsOhxRnfaZUFBSD5UaR5
eh9/jKxfAlGN6xynO73IYbZQax8OCGAG8na9SelD4QKBgQC2TOhoxhftg+d/pXK1
CsAB/q/bIzmM1czC5HMZh52SJKGimUnRSbSKDiX2MTlXNIKxf8O00cH076FU5gZp
18Er5D6b1nF4NhdmJEq+Y39DixqM9/ktArBoPMiqDxNMUvq0FVPRWA9vveTurVV5
07ms5h7Ch2b2aIz4ckx1YpLg+wKBgQDji8yRZmNxzALesv5f7Rpr4Sv35Gd4UaL5
R2N0N8C8nZAh/I+eWf9b/2u8s0tNt6v6U4YSI2F9koZyvRfAKRB9K7zOfaIcvxy7
VTvSHpUavuK1f7FAsygNAYRDcEqX4m/7oEMs3MEBfgk1pkePA6Btoqfs2lfgc1y7
dnx17QLXrwKBgQCKo8ioTebKomL/Z6Lp3mgR3FB/VrWgzsQvf6+tPb7u8t7eGrfR
67zatVHXfq3+DRhLxz/eFxvrnAZU268K9aOaLrYSrC6VXoXDD1ysmFyj0Hl7teaR
fZcNXxS4iEiD5iN1qzaYYeEzePZPMhFsWkG+JTBFftYmFXMIS1ysdTAA2wKBgQC5
NxT3kVEG0tnPLgFSUav8/dcNO3RhgonWwJ4afjs7DEHC+FJqwbTSzJCEk6iLBSNO
amgqIXR8gyU/Bd3sQ0CxskVICwlGvuUDMzizKsORdqkQtXSxRmMmWwKu5htBkEY4
mlWzkajkrxOOAOAkb/5I32oyp/N5tk1YJfTfBGIY7wKBgFYFFhYsYXtZE24k+7y+
KsTVyjc2AjRrG25BleEEvEEZkrltZ3RqirwasclAhOpdzvd59uzNgnPWwq3duj7H
VtHK877LgPh5qhlwGI2i1i5wMO71lZtPcqNZPkvjhV5YUzp6BRF+HDsF7mn68ZA1
7jNNIb06iJ8Ur9kYSgYdQslE
-----END PRIVATE KEY-----`)

var certNoPass = []byte(
	`-----BEGIN CERTIFICATE-----
MIIC3TCCAcUCFBL/b/HwmR9F9EK1u8PQvmNPFMo3MA0GCSqGSIb3DQEBCwUAMCsx
HDAaBgNVBAMME3Rlc3RDZXJ0V2l0aG91dFBhc3MxCzAJBgNVBAYTAlNLMB4XDTI0
MDkxOTEyMzQ1NFoXDTI3MDkxOTEyMzQ1NFowKzEcMBoGA1UEAwwTdGVzdENlcnRX
aXRob3V0UGFzczELMAkGA1UEBhMCU0swggEiMA0GCSqGSIb3DQEBAQUAA4IBDwAw
ggEKAoIBAQCiCb+D7DddLgsUTP4wu6B4fvFqmYbMH9O+mvP6iwAS2jazOrw2Was8
+AKafxnSM1TrbPgH3nUS6TzMiSrisDgPUuZ/MxvSFG2VFNhB/vujteI6tyXZdNpi
ptvxJumHvPR4Qjc9wrCYl3qhx6T/KkKVkBEXi0+frWUJw0xFNiKu8Rdgo4ceZ3kH
Zt/ZqESDf26v18clQETBB7oRWzPmuktnCyX2WPN/B2DWl9eDNMUtQt8HzA8XhOL5
nFYUYXOKmFSprD29JaeeKCrFYkIDfLq+k2lzxo1Btur6u1gJyOOi5X1hfoGgZNIN
NnWeuw0iuqX2Wgw9HjfBV1hSACzeUJiVAgMBAAEwDQYJKoZIhvcNAQELBQADggEB
AHAoaCc0iaHOhr7nxDBOl7qPsrIpA95TU1d0rTaLQpK8Z5wC3+a0JvAxRk+RgIMA
1Z+mL326gg2o7L3SdjVzkhBe/3+7RzAfuH/k8S8hn72G548o3XkQP87JmLUXs1+6
2t467hpNPbuboO2lspCEEWbYs2kLFIFIE4V+iQe4xabz/tBgy2fE0hI1gwtWqonO
ZXEiT0mcWOdtRV5WfkkSrjE0BtWUW6r+eW/0ZSLPESnGqBIpTgzDEk29bWbbMdwh
dsdSPwCrdg9wYOPr1CNjfoA6GjX5SipJ6rU1hOzcOF8SQh0Oh9a5kpfkVD+ktHxr
+eLHA9/oarks8uDsI8ZzsPI=
-----END CERTIFICATE-----`)
