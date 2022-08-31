package sender

import (
	"testing"

	"github.com/prometheus/alertmanager/api/v2/models"
	"github.com/prometheus/prometheus/pkg/labels"
	"github.com/stretchr/testify/require"
)

func TestSanitizeLabelName(t *testing.T) {
	cases := []struct {
		desc           string
		labelName      string
		expectedResult string
		expectedErr    string
	}{
		{
			desc:           "Remove whitespace",
			labelName:      "   a\tb\nc\vd\re\ff   ",
			expectedResult: "abcdef",
		},
		{
			desc:           "Replace ASCII with underscore",
			labelName:      " !\"#$%&\\'()*+,-./0123456789:;<=>?@ABCDEFGHIJKLMNOPQRSTUVWXYZ[\\]^_`abcdefghijklmnopqrstuvwxyz{|}~",
			expectedResult: "________________0123456789_______ABCDEFGHIJKLMNOPQRSTUVWXYZ______abcdefghijklmnopqrstuvwxyz____",
		},
		{
			desc:           "Replace non-ASCII unicode with hex",
			labelName:      "_€_ƒ_„_†_‡_œ_Ÿ_®_º_¼_×_ð_þ_¿_±_四_十_二_🔥",
			expectedResult: "_20ac_192_201e_2020_2021_153_178_ae_ba_bc_d7_f0_fe_bf_b1_56db_5341_4e8c_1f525",
		},
		{
			desc:        "Empty string should error",
			labelName:   "",
			expectedErr: "label name cannot be empty",
		},
		{
			desc:        "Only whitespace should error",
			labelName:   "   \t\n\v\n\f   ",
			expectedErr: "label name only contains invalid chars",
		},
	}

	for _, tc := range cases {
		am, _ := NewExternalAlertmanagerSender()
		t.Run(tc.desc, func(t *testing.T) {
			res, err := am.sanitizeLabelName(tc.labelName)

			if tc.expectedErr != "" {
				require.EqualError(t, err, tc.expectedErr)
			}

			require.Equal(t, tc.expectedResult, res)
		})
	}
}

func TestSanitizeLabelSet(t *testing.T) {
	cases := []struct {
		desc           string
		labelset       models.LabelSet
		expectedResult labels.Labels
	}{
		{
			desc: "Duplicate labels after sanitizations, append short has as suffix to duplicates",
			labelset: models.LabelSet{
				"test-alert": "42",
				"test_alert": "43",
				"test+alert": "44",
			},
			expectedResult: labels.Labels{
				labels.Label{Name: "test_alert", Value: "44"},
				labels.Label{Name: "test_alert_ed6237", Value: "42"},
				labels.Label{Name: "test_alert_a67b5e", Value: "43"},
			},
		},
		{
			desc: "If sanitize fails for a label, skip it",
			labelset: models.LabelSet{
				"test-alert":       "42",
				"   \t\n\v\n\f   ": "43",
				"test+alert":       "44",
			},
			expectedResult: labels.Labels{
				labels.Label{Name: "test_alert", Value: "44"},
				labels.Label{Name: "test_alert_ed6237", Value: "42"},
			},
		},
	}

	for _, tc := range cases {
		am, _ := NewExternalAlertmanagerSender()
		t.Run(tc.desc, func(t *testing.T) {
			require.Equal(t, tc.expectedResult, am.sanitizeLabelSet(tc.labelset))
		})
	}
}
