import { selectors as e2eSelectors } from '@grafana/e2e-selectors';
import { Trans, t } from '@grafana/i18n';
import { Label, Spinner, Stack, Switch } from '@grafana/ui';

import { ThemePicker } from '../../dashboard/components/ShareModal/ThemePicker';

interface Props {
  useLockedTime: boolean;
  onToggleLockedTime: () => void;
  useShortUrl: boolean;
  onUrlShorten: () => void;
  selectedTheme: string;
  onChangeTheme: (v: string) => void;
  isLoading: boolean;
}

const selectors = e2eSelectors.pages.ShareDashboardDrawer.ShareInternally;

export default function ShareInternallyConfiguration({
  useLockedTime,
  onToggleLockedTime,
  useShortUrl,
  onUrlShorten,
  onChangeTheme,
  selectedTheme,
  isLoading,
}: Props) {
  return (
    <Stack justifyContent="space-between">
      <Stack gap={2} direction="column">
        <Stack gap={1} direction="column">
          <Stack gap={1} alignItems="start">
            <Switch
              label={t('link.share.time-range-label', 'Lock time range')}
              id="share-current-time-range"
              value={useLockedTime}
              onChange={onToggleLockedTime}
              data-testid={selectors.lockTimeRangeSwitch}
            />
            <Label
              description={t(
                'link.share.time-range-description',
                'Change the current relative time range to an absolute time range'
              )}
              id="time-range-description"
            >
              <Trans i18nKey="link.share.time-range-label">Lock time range</Trans>
            </Label>
          </Stack>
          <Stack gap={1} alignItems="start">
            <Switch
              id="share-short-url"
              value={useShortUrl}
              label={t('link.share.short-url-label', 'Shorten link')}
              onChange={onUrlShorten}
              data-testid={selectors.shortenUrlSwitch}
            />
            <Label>
              <Trans i18nKey="link.share.short-url-label">Shorten link</Trans>
            </Label>
          </Stack>
        </Stack>
        <ThemePicker selectedTheme={selectedTheme} onChange={onChangeTheme} />
      </Stack>
      {isLoading && <Spinner />}
    </Stack>
  );
}
