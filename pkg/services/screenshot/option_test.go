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

	o.From = "now-6h"
	o = o.SetDefaults()
	assert.Equal(t, ScreenshotOptions{
		From:    "now-6h",
		To:      DefaultTo,
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
	assert.Equal(t, []byte{0xd9, 0x83, 0x82, 0x18, 0x6c, 0x3d, 0x7d, 0x47}, o.Hash())

	o = o.SetDefaults()
	assert.Equal(t, []byte{0x3, 0x52, 0x33, 0x5f, 0xed, 0x96, 0x47, 0xb5}, o.Hash())

	o.From = "now-6h"
	assert.Equal(t, []byte{0x1b, 0x61, 0xc4, 0x40, 0x1f, 0xae, 0xa0, 0xe0}, o.Hash())

	o.To = "now-2h"
	assert.Equal(t, []byte{0x2, 0x4f, 0xfd, 0xd5, 0x68, 0xdd, 0xd1, 0x99}, o.Hash())

	o.Width = 100
	o = o.SetDefaults()
	assert.Equal(t, []byte{0x16, 0x6c, 0xd, 0xad, 0x9f, 0x32, 0x9d, 0x1}, o.Hash())

	o.Height = 100
	o = o.SetDefaults()
	assert.Equal(t, []byte{0x2, 0x82, 0x96, 0x68, 0x2b, 0x57, 0x7d, 0xdd}, o.Hash())

	o.Theme = "Not a theme"
	o = o.SetDefaults()
	assert.Equal(t, []byte{0x2, 0x82, 0x96, 0x68, 0x2b, 0x57, 0x7d, 0xdd}, o.Hash())

	// the timeout should not change the sum
	o.Timeout = DefaultTimeout + 1
	assert.Equal(t, []byte{0x2, 0x82, 0x96, 0x68, 0x2b, 0x57, 0x7d, 0xdd}, o.Hash())
}
