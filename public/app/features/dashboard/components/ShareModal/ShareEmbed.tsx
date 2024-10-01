import { FormEvent, useEffect, useState } from 'react';
import { useEffectOnce } from 'react-use';

import { RawTimeRange, TimeRange } from '@grafana/data';
import { config, reportInteraction } from '@grafana/runtime';
import { Button, ClipboardButton, Field, Label, Modal, Stack, Switch, TextArea } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';

import { ThemePicker } from './ThemePicker';
import { ShareModalTabProps } from './types';
import { buildIframeHtml, getTrackingSource } from './utils';

interface Props extends Omit<ShareModalTabProps, 'panel' | 'dashboard'> {
  panel?: { timeFrom?: string; id: number };
  dashboard: { uid: string; time: RawTimeRange };
  range?: TimeRange;
  buildIframe?: typeof buildIframeHtml;
  onCancelClick?: () => void;
}

export function ShareEmbed({ panel, dashboard, range, onCancelClick, buildIframe = buildIframeHtml }: Props) {
  const [useCurrentTimeRange, setUseCurrentTimeRange] = useState(true);
  const [selectedTheme, setSelectedTheme] = useState('current');
  const [iframeHtml, setIframeHtml] = useState('');

  useEffectOnce(() => {
    reportInteraction('grafana_dashboards_embed_share_viewed', { shareResource: getTrackingSource(panel) });
  });

  useEffect(() => {
    const newIframeHtml = buildIframe(useCurrentTimeRange, dashboard.uid, selectedTheme, panel, range);
    setIframeHtml(newIframeHtml);
  }, [selectedTheme, useCurrentTimeRange, dashboard, panel, range, buildIframe]);

  const onIframeHtmlChange = (event: FormEvent<HTMLTextAreaElement>) => {
    setIframeHtml(event.currentTarget.value);
  };

  const onUseCurrentTimeRangeChange = () => {
    setUseCurrentTimeRange((useCurTimeRange) => !useCurTimeRange);
  };

  const onThemeChange = (value: string) => {
    setSelectedTheme(value);
  };

  const clipboardButton = (
    <ClipboardButton
      icon="copy"
      variant="primary"
      getText={() => iframeHtml}
      onClipboardCopy={() => {
        DashboardInteractions.embedSnippetCopy({
          currentTimeRange: useCurrentTimeRange,
          theme: selectedTheme,
          shareResource: getTrackingSource(panel),
        });
      }}
    >
      <Trans i18nKey="share-modal.embed.copy">Copy to clipboard</Trans>
    </ClipboardButton>
  );

  return (
    <>
      <p>
        <Trans i18nKey="share-modal.embed.info">Generate HTML for embedding an iframe with this panel</Trans>
      </p>
      <Field>
        <Stack gap={1} alignItems="start">
          <Switch
            label={t('share-modal.embed.time-range', 'Lock time range')}
            id="share-current-time-range"
            value={useCurrentTimeRange}
            onChange={onUseCurrentTimeRangeChange}
          />
          <Label
            description={t(
              'embed.share.time-range-description',
              'Change the current relative time range to an absolute time range'
            )}
          >
            <Trans i18nKey="embed.share.time-range-label">Lock time range</Trans>
          </Label>
        </Stack>
      </Field>
      <ThemePicker selectedTheme={selectedTheme} onChange={onThemeChange} />
      <Field
        label={t('share-modal.embed.html', 'Embed HTML')}
        description={t(
          'share-modal.embed.html-description',
          'The HTML code below can be pasted and included in another web page. Unless anonymous access is enabled, the users viewing that page need to be signed into Grafana for the graph to load.'
        )}
      >
        <TextArea
          data-testid="share-embed-html"
          id="share-panel-embed-embed-html-textarea"
          rows={5}
          value={iframeHtml}
          onChange={onIframeHtmlChange}
        />
      </Field>
      {config.featureToggles.newDashboardSharingComponent ? (
        <Stack gap={1} justifyContent={'start'}>
          {clipboardButton}
          <Button variant="secondary" fill="outline" onClick={onCancelClick}>
            <Trans i18nKey="snapshot.share.cancel-button">Cancel</Trans>
          </Button>
        </Stack>
      ) : (
        <Modal.ButtonRow>{clipboardButton}</Modal.ButtonRow>
      )}
    </>
  );
}
