package webassets

import (
	"context"
	"encoding/json"
	"fmt"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestReadWebassets(t *testing.T) {
	assets, err := readWebAssetsFromFile("testdata/sample-assets-manifest.json")
	require.NoError(t, err)

	dto, err := json.MarshalIndent(assets, "", "  ")
	require.NoError(t, err)
	// fmt.Printf("%s\n", string(dto))

	require.JSONEq(t, `{
		"jsFiles": [
			{
			"filePath": "public/build/runtime~app.1140e4861852d9e6f2e2.js",
			"integrity": "sha256-HwsNc3NYC6Ee9cwVjOiEvhAmcaoe8HIwlwiVu/gc+D4= sha384-tt6bizrzSNPJH+uQGvcBokWaWp34sh0jp015BO7ZAO7HujvBjlduOid/30hz64DK sha512-hC1VmDBaqkULR+iPfPyAY4ZwAa5BXrahre0UrvO7+gLIpv810eu3uCGm5YTm+lFb+YFuBPlJDC4X2DarrEc5sg=="
			},
			{
			"filePath": "public/build/app.5e6b0a8f6800cdea4a51.js",
			"integrity": "sha256-xLLqXfNJ3+ybFt0Y3519SRZ8BkZvYm30epIE2y5EaIs= sha384-A/LoksVaN1WL6LO53SVm4KcBciyP6leDAdLLrxk13g0iPRMqOPEF+r7qEl0QnHp1 sha512-amLUBch//DibrSurQ2Zt5oUDvdhl48z3Scw7gqp2ASR0jcsLeev3RHcUJKrpW0GDTMRbUEAhIqFL9he2iYzg9g=="
			}
		],
		"dark": "public/build/grafana.dark.d27cc3e33cf31ab577e7.css",
		"light": "public/build/grafana.light.e6be3c7d879fd499516e.css",
		"swagger": [
			{
			"filePath": "public/build/runtime~swagger.793c8e6ede4824f9b730.js",
			"integrity": "sha256-cXK7bq3M16fgI1WgELNFabHXVvn84rPN960QwrmTKiQ= sha384-Ysrs6mXl6RUK5nyttGRFQh4ABbpqxnsckFdJFI7FTU9ZQnyXl04DCam0ADj6t43G sha512-l5lei1D6HlvLrxCVovMdwNhMLDc0zO7u/fJwIvASbi49HjuJRsn6cTw/ZBfeghtqBJF0mZeg+fXo0ZKriY8Wlg=="
			},
			{
			"filePath": "public/build/swagger.789d2ab30a8124d2a92c.js",
			"integrity": "sha256-zvXf9SHyzCHFvuOGphlImo8zbJ6jnJVXQOzUFNMPMW8= sha384-GLZ2Z9nV1opFHaQXC6pehHmy4XOBImvDk1w7b8QdYeyobarSrA93CzxjfrtCnA2Y sha512-CZ2oIrYuWGaGU+EZr4/KEFerOZU9XS2NELNNsIwtzs7Zcw/rroa4fU0PiZvXbeT+B2kUy1rGLAQ5nwgR0sQlNA=="
			}
		]
		}`, string(dto))

	assets.SetContentDeliveryURL("https://grafana-assets.grafana.net/grafana/10.3.0-64123/")

	dto, err = json.MarshalIndent(assets, "", "  ")
	require.NoError(t, err)
	fmt.Printf("%s\n", string(dto))

	require.JSONEq(t, `{
		"cdn": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/",
		"jsFiles": [
			{
			"filePath": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/runtime~app.1140e4861852d9e6f2e2.js",
			"integrity": "sha256-HwsNc3NYC6Ee9cwVjOiEvhAmcaoe8HIwlwiVu/gc+D4= sha384-tt6bizrzSNPJH+uQGvcBokWaWp34sh0jp015BO7ZAO7HujvBjlduOid/30hz64DK sha512-hC1VmDBaqkULR+iPfPyAY4ZwAa5BXrahre0UrvO7+gLIpv810eu3uCGm5YTm+lFb+YFuBPlJDC4X2DarrEc5sg=="
			},
			{
			"filePath": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/app.5e6b0a8f6800cdea4a51.js",
			"integrity": "sha256-xLLqXfNJ3+ybFt0Y3519SRZ8BkZvYm30epIE2y5EaIs= sha384-A/LoksVaN1WL6LO53SVm4KcBciyP6leDAdLLrxk13g0iPRMqOPEF+r7qEl0QnHp1 sha512-amLUBch//DibrSurQ2Zt5oUDvdhl48z3Scw7gqp2ASR0jcsLeev3RHcUJKrpW0GDTMRbUEAhIqFL9he2iYzg9g=="
			}
		],
		"dark": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/grafana.dark.d27cc3e33cf31ab577e7.css",
		"light": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/grafana.light.e6be3c7d879fd499516e.css",
		"swagger": [
			{
			"filePath": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/runtime~swagger.793c8e6ede4824f9b730.js",
			"integrity": "sha256-cXK7bq3M16fgI1WgELNFabHXVvn84rPN960QwrmTKiQ= sha384-Ysrs6mXl6RUK5nyttGRFQh4ABbpqxnsckFdJFI7FTU9ZQnyXl04DCam0ADj6t43G sha512-l5lei1D6HlvLrxCVovMdwNhMLDc0zO7u/fJwIvASbi49HjuJRsn6cTw/ZBfeghtqBJF0mZeg+fXo0ZKriY8Wlg=="
			},
			{
			"filePath": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/swagger.789d2ab30a8124d2a92c.js",
			"integrity": "sha256-zvXf9SHyzCHFvuOGphlImo8zbJ6jnJVXQOzUFNMPMW8= sha384-GLZ2Z9nV1opFHaQXC6pehHmy4XOBImvDk1w7b8QdYeyobarSrA93CzxjfrtCnA2Y sha512-CZ2oIrYuWGaGU+EZr4/KEFerOZU9XS2NELNNsIwtzs7Zcw/rroa4fU0PiZvXbeT+B2kUy1rGLAQ5nwgR0sQlNA=="
			}
		]
		}`, string(dto))
}

func TestReadWebassetsFromCDN(t *testing.T) {
	t.Skip()

	assets, err := readWebAssetsFromCDN(context.Background(), "https://grafana-assets.grafana.net/grafana/10.3.0-64123/")
	require.NoError(t, err)

	dto, err := json.MarshalIndent(assets, "", "  ")
	require.NoError(t, err)
	//fmt.Printf("%s\n", string(dto))

	require.JSONEq(t, `{
		"cdn": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/",
		"jsFiles": [
		  {
			"filePath": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/runtime.6d702760ddd47772f116.js",
			"integrity": "sha256-6tSxwMwqd9McukcH+i56v1v+8JsVlMXPWKUCIK30yK8= sha384-dfRWJ5QfPAiQKJ9fUugmeXVdRSx8OS3XUdkEyEhxkm9CZQf9KeUyUe6fGV7VL7s9 sha512-0kjFCSBeQtdS3F9B/uqX45KMMUffYpsU7Ve7AYjy75HiBzovxRGG4hWPZD7d4Gha0Y3Oj4AmZA37TJoafptlRQ=="
		  },
		  {
			"filePath": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/7653.f5c70a70add3b711f560.js",
			"integrity": "sha256-p65DYfZPt9NU7vDwlxW+sY9sK+wQ9tJgTGlCJt+LvxY= sha384-P1TDQw3ZJ4X6Fiyn6UpLpVuHq+UW3zKRUM6U0vjucSl/bjFmQJfGR9XE64uEn6sJ sha512-sPqhDs/mWUBL6txtyoTdlgyZvVfdttUAXdV39aEroYpSnl/uEoLIcNBem5mNxoh4ut4TpSb9hlW6tTD7QV07/g=="
		  },
		  {
			"filePath": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/182.0b85a6da60c3ae0a9093.js",
			"integrity": "sha256-4vJBytomvJYkSsXlAo7BXDiXRsi5JVWBosIZSMCYlqs= sha384-MWfyWG85/+OvsA4E9CvG1NGiSzrp/EH37Xd/+qfdMFKmvAEGzGx9N/4xF+3N3/yj sha512-j1h6qobFAJYU+7QFdcChEeHa/FPXuArEsHJuXSYtaqrDU7oNHyW1PqFz6kNUwqE674Hutl93EeY+UsUlpZgZZQ=="
		  },
		  {
			"filePath": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/8781.91ede282a7f6078508e7.js",
			"integrity": "sha256-b68VAYMTugwWaHtffKI4qCMSWTN/fg0xQv+MnSILQgg= sha384-ptDkcAAAQhuG9Mhvs6gvGIp0HIjCfAP+ysaMltIr3L5alN6Ki71Si/zO6C70YArC sha512-N5tkcDgTPcNvQymegqnx0syp0kS7wVzPnt7i5KSu/RAi6cfM9XiRfz7bZh6fcZAJxApvpL1OJhUQQwPFFBN4ZA=="
		  },
		  {
			"filePath": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/3958.1d29ae9e8eb421432f48.js",
			"integrity": "sha256-9c+QGDOI8HtAzVBLA3nJOOU+LzhoENAhIEw7gGSkgWY= sha384-Y05zEdrM/ab9jzGH6segO9GyE8OTV5RvWPZFgynXX4XgvMOyWJcySqwW4RoIVo6P sha512-+ro4iXipgz1zUySd8oMbOY6XX+RjP4gi8bksFNjJGiLQOHVb/EKZKDj5UBeIE96XMd1AoEvZdymCvaft3d8oeA=="
		  },
		  {
			"filePath": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/app.18e8d3e07edcc1356a6a.js",
			"integrity": "sha256-ueeH8P/rDaft7jtzRmTN4UpNtiPfhzYa7c1VbBiRLTo= sha384-SijeOWlmIMzm/WNVg5e+yMieef6LOFXMu8d2laBtaY/2m/fviGI+8W55jazWzb+C sha512-qr5MoBZ4wNTCm6aRQ5/mglO8gShmKFpvr066SJgKyAJA4j8cK0snL2XhubUNxND+KkpKAnRe7EjsHYd28/uvkw=="
		  }
		],
		"dark": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/grafana.dark.b44253d019cd9cb46428.css",
		"light": "https://grafana-assets.grafana.net/grafana/10.3.0-64123/public/build/grafana.light.e8e11c59b604d62836be.css"
	  }`, string(dto))
}
