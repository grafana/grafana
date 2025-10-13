package screenshot

import (
	"testing"

	"github.com/stretchr/testify/assert"
)

func TestScreenshotOptions(t *testing.T) {
	o := ScreenshotOptions{}
	assert.Equal(t, ScreenshotOptions{}, o)

	o = o.SetDefaults()
	assert.Equal(t, ScreenshotOptions{
		Width:   DefaultWidth,
		Height:  DefaultHeight,
		Theme:   DefaultTheme,
		Timeout: DefaultTimeout,
	}, o)

	o.From = "now-6h"
	o = o.SetDefaults()
	assert.Equal(t, ScreenshotOptions{
		From:    "now-6h",
		Width:   DefaultWidth,
		Height:  DefaultHeight,
		Theme:   DefaultTheme,
		Timeout: DefaultTimeout,
	}, o)

	o.To = "now-2h"
	o = o.SetDefaults()
	assert.Equal(t, ScreenshotOptions{
		From:    "now-6h",
		To:      "now-2h",
		Width:   DefaultWidth,
		Height:  DefaultHeight,
		Theme:   DefaultTheme,
		Timeout: DefaultTimeout,
	}, o)

	o.Width = 100
	o = o.SetDefaults()
	assert.Equal(t, ScreenshotOptions{
		From:    "now-6h",
		To:      "now-2h",
		Width:   100,
		Height:  DefaultHeight,
		Theme:   DefaultTheme,
		Timeout: DefaultTimeout,
	}, o)

	o.Height = 100
	o = o.SetDefaults()
	assert.Equal(t, ScreenshotOptions{
		From:    "now-6h",
		To:      "now-2h",
		Width:   100,
		Height:  100,
		Theme:   DefaultTheme,
		Timeout: DefaultTimeout,
	}, o)

	o.Theme = "Not a theme"
	o = o.SetDefaults()
	assert.Equal(t, ScreenshotOptions{
		From:    "now-6h",
		To:      "now-2h",
		Width:   100,
		Height:  100,
		Theme:   DefaultTheme,
		Timeout: DefaultTimeout,
	}, o)

	o.Timeout = DefaultTimeout + 1
	assert.Equal(t, ScreenshotOptions{
		From:    "now-6h",
		To:      "now-2h",
		Width:   100,
		Height:  100,
		Theme:   DefaultTheme,
		Timeout: DefaultTimeout + 1,
	}, o)
}

func TestScreenshotOptions_Hash(t *testing.T) {
	o := ScreenshotOptions{}
	assert.Equal(t, []byte{0xd7, 0xf3, 0x56, 0x7f, 0xec, 0x7b, 0xdf, 0x95}, o.Hash())

	o = o.SetDefaults()
	assert.Equal(t, []byte{0x71, 0x54, 0xe8, 0xea, 0x2, 0xf4, 0xd6, 0xd3}, o.Hash())

	o.OrgID = 1
	assert.Equal(t, []byte{0x8, 0x75, 0x48, 0x46, 0x88, 0xa9, 0xf3, 0xe6}, o.Hash())

	o.From = "now-6h"
	assert.Equal(t, []byte{0xfc, 0xd9, 0xe5, 0xa4, 0x32, 0xde, 0x33, 0x8b}, o.Hash())

	o.To = "now-2h"
	assert.Equal(t, []byte{0x8b, 0x78, 0xf4, 0xe7, 0xaa, 0x6, 0xba, 0xde}, o.Hash())

	o.Width = 100
	assert.Equal(t, []byte{0xa8, 0x75, 0x43, 0xc1, 0xb5, 0xd5, 0xd2, 0x3c}, o.Hash())

	o.Height = 100
	assert.Equal(t, []byte{0x3d, 0xf3, 0x37, 0x3d, 0x9a, 0xfd, 0x71, 0x88}, o.Hash())

	o.Theme = "Not a theme"
	assert.Equal(t, []byte{0x3b, 0xd1, 0xfb, 0x3f, 0x3, 0x64, 0xba, 0xad}, o.Hash())

	// the timeout should not change the sum
	o.Timeout = DefaultTimeout + 1
	assert.Equal(t, []byte{0x3b, 0xd1, 0xfb, 0x3f, 0x3, 0x64, 0xba, 0xad}, o.Hash())
}
