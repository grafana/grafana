package store

import (
	"testing"

	"github.com/grafana/grafana-plugin-sdk-go/data"
	"github.com/stretchr/testify/require"
)

var (
	exampleListFrameJSON = `{
  "schema": {
    "meta": {
      "type": "directory-listing",
      "custom": {
        "HasMore": false
      }
    },
    "fields": [
      {
        "name": "name",
        "type": "string",
        "typeInfo": {
          "frame": "string"
        }
      },
      {
        "name": "mediaType",
        "type": "string",
        "typeInfo": {
          "frame": "string"
        }
      },
      {
        "name": "size",
        "type": "number",
        "typeInfo": {
          "frame": "int64"
        },
        "config": {
          "unit": "bytes"
        }
      }
    ]
  },
  "data": {
    "values": [
      [
        "DL_1.jpg",
        "Screen Shot 2022-06-23 at 9.05.39 PM.png",
        "Screen Shot 2022-06-24 at 11.58.32 AM.png",
        "Screen Shot 2022-06-30 at 3.45.03 PM.png",
        "Screen Shot 2022-07-05 at 3.24.27 PM.png",
        "image.png",
        "rocket_1f680.png",
        "test-folder",
        "topcoder12.png"
      ],
      [
        "image/jpeg",
        "image/png",
        "image/png",
        "image/png",
        "image/png",
        "image/png",
        "image/png",
        "directory",
        "image/png"
      ],
      [
        943004,
        684257,
        256396,
        8796,
        388290,
        182568,
        29066,
        0,
        90563
      ]
    ]
  }
}
`
	exampleRootLevelListJSON = `{
  "schema": {
    "meta": {
      "type": "directory-listing"
    },
    "fields": [
      {
        "name": "name",
        "type": "string",
        "typeInfo": {
          "frame": "string"
        }
      },
      {
        "name": "title",
        "type": "string",
        "typeInfo": {
          "frame": "string"
        }
      },
      {
        "name": "description",
        "type": "string",
        "typeInfo": {
          "frame": "string"
        }
      },
      {
        "name": "mediaType",
        "type": "string",
        "typeInfo": {
          "frame": "string"
        }
      },
      {
        "name": "storageType",
        "type": "string",
        "typeInfo": {
          "frame": "string"
        }
      },
      {
        "name": "readOnly",
        "type": "boolean",
        "typeInfo": {
          "frame": "bool"
        }
      },
      {
        "name": "builtIn",
        "type": "boolean",
        "typeInfo": {
          "frame": "bool"
        }
      }
    ]
  },
  "data": {
    "values": [
      [
        "public-static",
        "resources"
      ],
      [
        "Public static files",
        "Resources"
      ],
      [
        "Access files from the static public files",
        "Upload custom resource files"
      ],
      [
        "directory",
        "directory"
      ],
      [
        "disk",
        "sql"
      ],
      [
        true,
        false
      ],
      [
        true,
        true
      ]
    ]
  }
}
`
)

func TestGetFileNames(t *testing.T) {
	frame := &data.Frame{}
	err := frame.UnmarshalJSON([]byte(exampleListFrameJSON))
	require.NoError(t, err)

	listFrame := StorageListFrame{frame}
	require.Equal(t, []string{
		"DL_1.jpg",
		"Screen Shot 2022-06-23 at 9.05.39 PM.png",
		"Screen Shot 2022-06-24 at 11.58.32 AM.png",
		"Screen Shot 2022-06-30 at 3.45.03 PM.png",
		"Screen Shot 2022-07-05 at 3.24.27 PM.png",
		"image.png", "rocket_1f680.png",
		"test-folder",
		"topcoder12.png",
	}, listFrame.GetFileNames())
}

func TestGetFileNamesRootLevel(t *testing.T) {
	frame := &data.Frame{}
	err := frame.UnmarshalJSON([]byte(exampleRootLevelListJSON))
	require.NoError(t, err)

	listFrame := StorageListFrame{frame}
	require.Equal(t, []string{
		"public-static",
		"resources",
	}, listFrame.GetFileNames())
}
