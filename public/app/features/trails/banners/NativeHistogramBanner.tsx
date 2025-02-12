import { css } from '@emotion/css';
import { useState, type Dispatch, type SetStateAction } from 'react';

import { GrafanaTheme2 } from '@grafana/data';
import { useStyles2, useTheme2, Alert, Button } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';

import { DataTrail } from '../DataTrail';
import { reportExploreMetrics } from '../interactions';
import { MetricSelectedEvent } from '../shared';

interface NativeHistogramInfoProps {
  histogramsLoaded: boolean;
  nativeHistograms: string[];
  trail: DataTrail;
}

export function NativeHistogramBanner(props: NativeHistogramInfoProps) {
  const { histogramsLoaded, nativeHistograms, trail } = props;
  const [histogramMessage, setHistogramMessage] = useState(true);
  const [showHistogramExamples, setShowHistogramExamples] = useState(false);
  const styles = useStyles2(getStyles, 0);

  if (bannerHasBeenShown() || !histogramsLoaded || nativeHistograms.length === 0 || !histogramMessage) {
    return null;
  }

  return (
    <>
      {
        <Alert
          title={'Native Histogram Support'}
          severity={'info'}
          onRemove={() => {
            // when a user explicitly closes the banner, save that it has been closed in local storage to not show again
            setBannerHasBeenShown();
            setHistogramMessage(false);
          }}
          className={styles.banner}
        >
          <div className={styles.histogramRow}>
            <div className={styles.histogramSentence}>
              <Trans i18nKey="trails.native-histogram-banner.sentence">
                Prometheus native histograms offer high resolution, high precision, simple usage in instrumentation and
                a way to combine and manipulate histograms in queries and in Grafana.
              </Trans>
            </div>
            <div className={styles.histogramLearnMore}>
              <div>
                <Button
                  onClick={() =>
                    window.open('https://grafana.com/docs/grafana-cloud/whats-new/native-histograms/', '_blank')
                  }
                  className={styles.button}
                >
                  <Trans i18nKey="trails.native-histogram-banner.learn-more">Learn more</Trans>
                </Button>
              </div>
            </div>
          </div>
          <NativeHistogramExamplesButton
            showHistogramExamples={showHistogramExamples}
            setShowHistogramExamples={setShowHistogramExamples}
          />
          {showHistogramExamples && (
            <NativeHistogramExamples
              trail={trail}
              nativeHistograms={nativeHistograms}
              setHistogramMessage={setHistogramMessage}
            />
          )}
        </Alert>
      }
    </>
  );
}

interface NativeHistogramExamplesButtonProps {
  showHistogramExamples: boolean;
  setShowHistogramExamples: Dispatch<SetStateAction<boolean>>;
}

const NativeHistogramExamplesButton = ({
  showHistogramExamples,
  setShowHistogramExamples,
}: NativeHistogramExamplesButtonProps) => {
  const styles = useStyles2(getStyles, 0);

  return (
    <div>
      <Button
        className={`${styles.seeExamplesButton} native-histogram-examples-button`}
        type="button"
        fill="text"
        variant="primary"
        onClick={() => {
          if (showHistogramExamples) {
            // hide the examples
            reportExploreMetrics('native_histogram_examples_closed', {});
          }
          setShowHistogramExamples(!showHistogramExamples);
        }}
      >
        {showHistogramExamples
          ? t(`trails.native-histogram-banner.hide-examples`, `Hide examples`)
          : t(`trails.native-histogram-banner.see-examples`, `> See examples`)}
      </Button>
    </div>
  );
};

type NativeHistogramExamplesProps = Pick<NativeHistogramInfoProps, 'trail' | 'nativeHistograms'> & {
  setHistogramMessage: Dispatch<SetStateAction<boolean>>;
};

const NativeHistogramExamples = ({ trail, nativeHistograms, setHistogramMessage }: NativeHistogramExamplesProps) => {
  const styles = useStyles2(getStyles, 0);
  const isDark = useTheme2().isDark;
  const selectNativeHistogram = (metric: string) => {
    reportExploreMetrics('native_histogram_example_clicked', {
      metric,
    });
    trail.publishEvent(new MetricSelectedEvent(metric), true);
  };
  const images = {
    nativeHeatmap: isDark
      ? 'public/img/native-histograms/DarkModeHeatmapNativeHistogram.png'
      : 'public/img/native-histograms/LightModeHeatmapNativeHistogram.png',
    classicHeatmap: isDark
      ? 'public/img/native-histograms/DarkModeHeatmapClassicHistogram.png'
      : 'public/img/native-histograms/LightModeHeatmapClassicHistogram.png',
    nativeHistogram: isDark
      ? 'public/img/native-histograms/DarkModeHistogramNativehistogram.png'
      : 'public/img/native-histograms/LightModeHistogramClassicHistogram.png',
    classicHistogram: isDark
      ? 'public/img/native-histograms/DarkModeHistogramClassicHistogram.png'
      : 'public/img/native-histograms/LightModeHistogramClassicHistogram.png',
  };

  return (
    <>
      <div className={`${styles.histogramRow} ${styles.seeExamplesRow}`}>
        <div className={styles.histogramImageCol}>
          <div>
            <Trans i18nKey="trails.native-histogram-banner.now">Now:</Trans>
          </div>
        </div>
        <div className={`${styles.histogramImageCol} ${styles.rightCol}`}>
          <div>
            <Trans i18nKey="trails.native-histogram-banner.previously">Previously:</Trans>
          </div>
        </div>
      </div>
      <div className={`${styles.histogramRow} ${styles.seeExamplesRow}`}>
        <div className={styles.histogramImageCol}>
          <div className={styles.histogramRow}>
            <div className={`${styles.histogramImageCol} ${styles.fontSmall}`}>
              <div className={styles.imageText}>
                <Trans i18nKey="trails.native-histogram-banner.nh-heatmap">
                  Native Histogram displayed as heatmap:
                </Trans>
              </div>
              <div>
                <img width="100%" src={images.nativeHeatmap} alt="Native Histogram displayed as heatmap" />
              </div>
            </div>
            <div className={`${styles.histogramImageCol} ${styles.fontSmall}`}>
              <div className={styles.imageText}>
                <Trans i18nKey="trails.native-histogram-banner.nh-histogram">
                  Native Histogram displayed as histogram:
                </Trans>
              </div>
              <div>
                <img width="100%" src={images.nativeHistogram} alt="Native Histogram displayed as histogram" />
              </div>
            </div>
          </div>
        </div>
        <div className={`${styles.histogramImageCol} ${styles.rightImageCol} ${styles.rightCol}`}>
          <div className={styles.histogramRow}>
            <div className={`${styles.histogramImageCol} ${styles.fontSmall}`}>
              <div className={styles.imageText}>
                <Trans i18nKey="trails.native-histogram-banner.ch-heatmap">
                  Classic Histogram displayed as heatmap:
                </Trans>
              </div>
              <div>
                <img width="100%" src={images.classicHeatmap} alt="Classic Histogram displayed as heatmap" />
              </div>
            </div>
            <div className={`${styles.histogramImageCol} ${styles.fontSmall}`}>
              <div className={styles.imageText}>
                <Trans i18nKey="trails.native-histogram-banner.ch-histogram">
                  Classic Histogram displayed as histogram:
                </Trans>
              </div>
              <div>
                <img width="100%" src={images.classicHistogram} alt="Classic Histogram displayed as histogram" />
              </div>
            </div>
          </div>
        </div>
      </div>
      <br />
      <div>
        <Trans i18nKey="trails.native-histogram-banner.click-histogram">
          Click any of the native histograms below to explore them:
        </Trans>
      </div>
      <div>
        {nativeHistograms.map((el) => {
          return (
            <div key={el}>
              <Button
                onClick={() => {
                  selectNativeHistogram(el);
                  setHistogramMessage(false);
                }}
                key={el}
                variant="primary"
                size="sm"
                fill="text"
                className={`native-histogram-example-clicked`}
              >
                {t('trails.native-histogram-banner.metric-examples', el)}
              </Button>
            </div>
          );
        })}
      </div>
    </>
  );
};

function getStyles(theme: GrafanaTheme2, _chromeHeaderHeight: number) {
  return {
    banner: css({
      flexGrow: 0,
    }),
    histogramRow: css({
      display: 'flex',
      flexDirection: 'row',
      gap: theme.spacing(2),
    }),
    histogramSentence: css({
      width: '90%',
    }),
    histogramLearnMore: css({
      width: '10%',
    }),
    button: css({
      float: 'right',
    }),
    seeExamplesButton: css({
      paddingLeft: '0px',
    }),
    seeExamplesRow: css({
      paddingTop: '4px',
    }),
    histogramImageCol: css({
      display: 'flex',
      flexDirection: 'column',
      flexBasis: '100%',
      flex: '1',
    }),
    fontSmall: css({
      fontSize: theme.typography.size.sm,
    }),
    imageText: css({
      paddingBottom: '4px',
    }),
    rightImageCol: css({
      borderLeft: `1px solid ${theme.colors.secondary.borderTransparent}`,
    }),
    rightCol: css({
      paddingLeft: '16px',
    }),
  };
}

export function setBannerHasBeenShown() {
  localStorage.setItem('nativeHistogramBanner', 'true');
}

export function bannerHasBeenShown() {
  return localStorage.getItem('nativeHistogramBanner') ?? false;
}
