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
		From:    DefaultFrom,
		To:      DefaultTo,
		Width:   DefaultWidth,
		Height:  DefaultHeight,
		Theme:   DefaultTheme,
		Timeout: DefaultTimeout,
	}, o)

	o.From = "now-4h"
	o = o.SetDefaults()
	assert.Equal(t, ScreenshotOptions{
		From:    "now-4h",
		To:      DefaultTo,
		Width:   DefaultWidth,
		Height:  DefaultHeight,
		Theme:   DefaultTheme,
		Timeout: DefaultTimeout,
	}, o)

	o.To = "now-2h"
	o = o.SetDefaults()
	assert.Equal(t, ScreenshotOptions{
		From:    "now-4h",
		To:      "now-2h",
		Width:   DefaultWidth,
		Height:  DefaultHeight,
		Theme:   DefaultTheme,
		Timeout: DefaultTimeout,
	}, o)

	o.Width = 100
	o = o.SetDefaults()
	assert.Equal(t, ScreenshotOptions{
		From:    "now-4h",
		To:      "now-2h",
		Width:   100,
		Height:  DefaultHeight,
		Theme:   DefaultTheme,
		Timeout: DefaultTimeout,
	}, o)

	o.Height = 100
	o = o.SetDefaults()
	assert.Equal(t, ScreenshotOptions{
		From:    "now-4h",
		To:      "now-2h",
		Width:   100,
		Height:  100,
		Theme:   DefaultTheme,
		Timeout: DefaultTimeout,
	}, o)

	o.Theme = "Not a theme"
	o = o.SetDefaults()
	assert.Equal(t, ScreenshotOptions{
		From:    "now-4h",
		To:      "now-2h",
		Width:   100,
		Height:  100,
		Theme:   DefaultTheme,
		Timeout: DefaultTimeout,
	}, o)

	o.Timeout = DefaultTimeout + 1
	assert.Equal(t, ScreenshotOptions{
		From:    "now-4h",
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
	assert.Equal(t, []byte{0x86, 0x2a, 0x5a, 0xd7, 0x1a, 0x79, 0xb2, 0x42}, o.Hash())

	o.OrgID = 1
	assert.Equal(t, []byte{0x52, 0x3f, 0x86, 0xe3, 0x59, 0x1a, 0x7f, 0xfd}, o.Hash())

	o.From = "now-4h"
	assert.Equal(t, []byte{0x5c, 0xbc, 0xb0, 0xe5, 0x85, 0x48, 0xd, 0xcb}, o.Hash())

	o.To = "now-2h"
	assert.Equal(t, []byte{0x5c, 0xd2, 0x37, 0xe5, 0x9a, 0x4f, 0x42, 0xcc}, o.Hash())

	o.Width = 100
	assert.Equal(t, []byte{0x47, 0x3f, 0xaa, 0x7a, 0xd5, 0xbd, 0xa1, 0x6}, o.Hash())

	o.Height = 100
	assert.Equal(t, []byte{0x69, 0x8, 0x2d, 0xf7, 0xa, 0xd6, 0x89, 0xa2}, o.Hash())

	o.Theme = "Not a theme"
	assert.Equal(t, []byte{0xcc, 0x95, 0xd5, 0x50, 0xfb, 0x74, 0x87, 0xb}, o.Hash())

	// the timeout should not change the sum
	o.Timeout = DefaultTimeout + 1
	assert.Equal(t, []byte{0xcc, 0x95, 0xd5, 0x50, 0xfb, 0x74, 0x87, 0xb}, o.Hash())
}
