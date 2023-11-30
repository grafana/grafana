package webassets

import (
	"encoding/json"
	"testing"

	"github.com/stretchr/testify/require"
)

func TestReadWebassets(t *testing.T) {
	assets, err := readWebAssets("testdata/sample-assets-manifest.json")
	require.NoError(t, err)

	dto, err := json.MarshalIndent(assets, "", "  ")
	require.NoError(t, err)
	//fmt.Printf("%s\n", string(dto))

	require.JSONEq(t, `{
		"JSFiles": [
		  {
			"FilePath": "public/build/runtime.20ed8c01880b812ed29f.js",
			"Integrity": "sha256-rcdxIHk6cWgu4jiFa1a+pWlileYD/R72GaS8ZACBUdw= sha384-I/VJZQkt+TuJTvu61ihdWPds7EHfLrW5CxeQ0x9gtSqoPg9Z17Uawz1yoYaTdxqQ sha512-4CPAbh4KdTmGxHoQw4pgpYmgAquupVfwfo6UBV2cGU3vGFnEwkhq320037ETwWs+n9xB/bAMOvrdabp1SA1+8g=="
		  },
		  {
			"FilePath": "public/build/3951.4e474348841d792ab1ba.js",
			"Integrity": "sha256-dHqXXTRA3osYhHr9rol8hOV0nC4VP0pr5tbMp5VD95Q= sha384-4QJaSTibnxdYeYsLnmXtd1+If6IkAmXlLR0uYHN5+N+fS0FegHRH7MIFaRGjiO1B sha512-vRLEeEGbxBCx0z+l/m14fSK49reqWGA9zQzsCrD+TQQBmP07YIoRPwopMMyxtKljbbRFV0bW2bUZ7ZvzOZYoIQ=="
		  },
		  {
			"FilePath": "public/build/3651.4e8f7603e9778e1e9b59.js",
			"Integrity": "sha256-+N7caL91pVANd7C/aquAneRTjBQenCwaEKqj+3qkjxc= sha384-GQR7GyHPEwwEVph9gGYWEWvMYxkITwcOjieehbPidXZrybuQyw9cpDkjnWo1tj/w sha512-zyPM+8AxyLuECEXjb9w6Z2Sy8zmJdkfTWQphcvAb8AU4ZdkCqLmyjmOs/QQlpfKDe0wdOLyR3V9QgTDDlxtVlQ=="
		  },
		  {
			"FilePath": "public/build/1272.8c79fc44bf7cd993c953.js",
			"Integrity": "sha256-d7MRVimV83v4YQ5rdURfTaaFtiedXP3EMLT06gvvBuQ= sha384-8tRpYHQ+sEkZ8ptiIbKAbKPpHTJVnmaWDN56vJoWWUCzV1Q2w034wcJNKDJDJdAs sha512-cIZWoJHusF8qODBOj2j4b18ewcLLMo/92YQSwYQjln2G5e3o1bSO476ox2I2iecJ/tnhQK5j01h9BzTt3dNTrA=="
		  },
		  {
			"FilePath": "public/build/6902.070074e8f5a989b8f4c3.js",
			"Integrity": "sha256-TMo/uTZueyEHtkBzlLZzhwYKWF0epE4qbouo5xcwZkU= sha384-xylZJMtJ7+EsUBBdQZvPh+BeHJ3BnfclqI2vx/8QC9jvfYe/lhRsWW9OMJsxE/Aq sha512-EOmf+KZQMFPoTWAROL8bBLFfHhgvDH8ONycq37JaV7lz+sQOTaWBN2ZD0F/mMdOD5zueTg/Y1RAUP6apoEcHNQ=="
		  },
		  {
			"FilePath": "public/build/app.0439db6f56ee4aa501b2.js",
			"Integrity": "sha256-q6muaKY7BuN2Ff+00aw69628MXatcFnLNzWRnAD98DI= sha384-gv6lAbkngOHR05bvyOR8dm/J3wIjQQWSjyxK7W8vt2rG9uxcjvvDQV7aI6YbUhfX sha512-o/0mSlJ/OoqrpGdOIWCE3ZCe8n+qqLbgNCERtx9G8FIzsv++CvIWSGbbILjOTGfnEfEQWcKMH0macVpVBSe1Og=="
		  }
		],
		"CSSDark": "public/build/grafana.dark.a28b24b45b2bbcc628cc.css",
		"CSSLight": "public/build/grafana.light.3572f6d5f8b7daa8d8d0.css"
	  }`, string(dto))
}
