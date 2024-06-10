import React, { FormEvent, useEffect, useState } from 'react';
import { useEffectOnce } from 'react-use';

import { RawTimeRange, TimeRange } from '@grafana/data';
import { reportInteraction } from '@grafana/runtime';
import { ClipboardButton, Field, Modal, Switch, TextArea } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { DashboardInteractions } from 'app/features/dashboard-scene/utils/interactions';

import { ThemePicker } from './ThemePicker';
import { ShareModalTabProps } from './types';
import { buildIframeHtml } from './utils';

interface Props extends Omit<ShareModalTabProps, 'panel' | 'dashboard'> {
  panel?: { timeFrom?: string; id: number };
  dashboard: { uid: string; time: RawTimeRange };
  range?: TimeRange;
  buildIframe?: typeof buildIframeHtml;
}

export function ShareEmbed({ panel, dashboard, range, buildIframe = buildIframeHtml }: Props) {
  const [useCurrentTimeRange, setUseCurrentTimeRange] = useState(true);
  const [selectedTheme, setSelectedTheme] = useState('current');
  const [iframeHtml, setIframeHtml] = useState('');

  useEffectOnce(() => {
    reportInteraction('grafana_dashboards_embed_share_viewed');
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

  const isRelativeTime = dashboard.time.to === 'now';
  const timeRangeDescription = isRelativeTime
    ? t(
        'share-modal.embed.time-range-description',
        'Transforms the current relative time range to an absolute time range'
      )
    : '';

  return (
    <>
      <p className="share-modal-info-text">
        <Trans i18nKey="share-modal.embed.info">Generate HTML for embedding an iframe with this panel.</Trans>
      </p>
      <Field label={t('share-modal.embed.time-range', 'Current time range')} description={timeRangeDescription}>
        <Switch id="share-current-time-range" value={useCurrentTimeRange} onChange={onUseCurrentTimeRangeChange} />
      </Field>
      <ThemePicker selectedTheme={selectedTheme} onChange={onThemeChange} />
      <Field
        label={t('share-modal.embed.html', 'Embed HTML')}
        description={t(
          'share-modal.embed.html-description',
          'The HTML code below can be pasted and included in another web page. Unless anonymous access is enabled, the user viewing that page need to be signed into Grafana for the graph to load.'
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
      <Modal.ButtonRow>
        <ClipboardButton
          icon="copy"
          variant="primary"
          getText={() => iframeHtml}
          onClipboardCopy={() => {
            DashboardInteractions.embedSnippetCopy({
              currentTimeRange: useCurrentTimeRange,
              theme: selectedTheme,
            });
          }}
        >
          <Trans i18nKey="share-modal.embed.copy">Copy to clipboard</Trans>
        </ClipboardButton>
      </Modal.ButtonRow>
    </>
  );
}
