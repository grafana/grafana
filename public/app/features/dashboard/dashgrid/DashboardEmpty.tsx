import { css, cx } from '@emotion/css';
import React, { useState } from 'react';
import InlineSVG from 'react-inlinesvg/esm';

import { GrafanaTheme2 } from '@grafana/data';
import { selectors } from '@grafana/e2e-selectors';
import { config, locationService, reportInteraction } from '@grafana/runtime';
import { Panel } from '@grafana/schema/dist/esm/veneer/dashboard.types';
import { Button, useStyles2, Text, TextArea, LoadingPlaceholder } from '@grafana/ui';
import { Trans } from 'app/core/internationalization';
import { DashboardModel } from 'app/features/dashboard/state';
import {
  checkDashboardResultQuality,
  createNewDashboardFromJSON,
  onAddLibraryPanel,
  onCreateNewPanel,
  onCreateNewRow,
  onGenerateDashboardWithAI,
  onGenerateDashboardWithSemanticSearch,
} from 'app/features/dashboard/utils/dashboard';
import { useDispatch, useSelector } from 'app/types';

import { DatasourceSuggestions } from '../components/DashGPT/DatasourceSuggestions';
import { setInitialDatasource } from '../state/reducers';

export interface Props {
  dashboard: DashboardModel;
  canCreate: boolean;
}

const DashboardEmpty = ({ dashboard, canCreate }: Props) => {
  const styles = useStyles2(getStyles);
  const dispatch = useDispatch();
  const initialDatasource = useSelector((state) => state.dashboard.initialDatasource);
  const [assistDescription, setAssistDescription] = React.useState('');
  const [assitsLoading, setAssitsLoading] = React.useState(false);
  const [isGenerationLoading, setIsGenerationLoading] = React.useState(false);
  const [error, setError] = useState<string | null>(null);

  const [feedbackToUser, setFeedbackToUser] = React.useState('');

  const onSearchDashboard = async () => {
    try {
      setAssitsLoading(true);
      let bestDashboardMatch = await onGenerateDashboardWithSemanticSearch(assistDescription);

      // ask AI for confirmation on dashboard quality, if not strong yes generate a custom one
      // we can easily extend this to involve AI in selection of best dashboard from 5 original results as well as returning whether or not
      // it is a strong match and to just generate a new dashboard in that case... all in one call probably
      let isDashboardMatchStrong;
      try {
        isDashboardMatchStrong = await checkDashboardResultQuality(bestDashboardMatch, assistDescription);
      } catch (e) {
        console.warn('Error checking dashboard quality', e);
        isDashboardMatchStrong = true;
      }

      if (!isDashboardMatchStrong) {
        setFeedbackToUser(
          'We could not find a great match for your description, generating a custom dashboard for you... this can take a while 😬'
        );
        bestDashboardMatch = await onGenerateDashboardWithAI(assistDescription);
      }
      setAssitsLoading(false);

      setFeedbackToUser('');

      const dashboardUrl = await createNewDashboardFromJSON(bestDashboardMatch);
      // Open the imported dashboard
      locationService.push(dashboardUrl);
    } catch (error: any) {
      console.log('error', JSON.stringify(error));
      setError(error?.message || 'Something went wrong, please try again.');
      setTimeout(function () {
        setError(null);
      }, 6000);
      setAssitsLoading(false);
      setFeedbackToUser('');
    }
  };

  const onGenerateDashboard = async () => {
    setIsGenerationLoading(true);
    try {
      const generatedDashboard = await onGenerateDashboardWithAI(assistDescription);
      if (generatedDashboard?.panels) {
        generatedDashboard?.panels.forEach((panel: Panel) => {
          dashboard.addPanel(panel);
        });
      }
    } catch (error: any) {
      setError(error?.message || 'Something went wrong, please try again.');
      setTimeout(function () {
        setError(null);
      }, 6000);
    }
    setIsGenerationLoading(false);
  };

  const onSelectSelectSuggestion = (suggestion: string) => {
    setAssistDescription(suggestion);
  };

  return (
    <div className={styles.centeredContent}>
      <div className={cx(styles.centeredContent, styles.wrapper)}>
        {/* DashGPT */}
        <div className={cx(styles.containerBox, styles.centeredContent, styles.assistAIContainer)}>
          <div className={styles.headerBig}>
            <Text element="h1" textAlignment="center" weight="medium">
              DashGPT can create a dashboard for you
            </Text>
          </div>
          <div className={cx(styles.centeredContent, styles.bodyBig, styles.assistAIBody)}>
            <Text element="p" textAlignment="center" color="secondary">
              Write a description of the dashboard that you need and we generate it for you.
            </Text>
            <DatasourceSuggestions onSelectSuggestion={onSelectSelectSuggestion} />
            <TextArea
              placeholder="Save time by quickly generating dashboards using AI"
              width={200}
              onChange={(e) => setAssistDescription(e.currentTarget.value)}
              value={assistDescription}
            />
            {!!error && <div className={styles.error}>{error}</div>}
            {feedbackToUser && <div className={styles.feedbackToUser}>{feedbackToUser}</div>}
            <div className={styles.llmButtons}>
              <Button
                size="md"
                icon="ai"
                fill="outline"
                data-testid={selectors.pages.AddDashboard.itemButton('Create new panel button')}
                onClick={onGenerateDashboard}
                disabled={isGenerationLoading || assitsLoading}
                tooltip="Have DashGPT generate a custom dashboard for you from scratch"
              >
                {isGenerationLoading ? (
                  <LoadingPlaceholder text="Generating response" className={styles.loadingPlaceholder} />
                ) : (
                  "I'm Feeling Lucky"
                )}
              </Button>
              <Button
                size="md"
                icon="ai"
                data-testid={selectors.pages.AddDashboard.itemButton('Create new panel button')}
                onClick={onSearchDashboard}
                disabled={assitsLoading || isGenerationLoading}
                tooltip="Have DashGPT find a dashboard from our curated templates or create a custom dashboard just for you if we don't have a great template for your use case."
              >
                {assitsLoading ? (
                  <LoadingPlaceholder text="Generating response" className={styles.loadingPlaceholder} />
                ) : (
                  'DashGPT It!'
                )}
              </Button>
              <InlineSVG className={styles.IAMGROT} src={'public/img/bg/GrotBotAI.svg'} />
            </div>
          </div>
        </div>

        <div className={cx(styles.containerBox, styles.centeredContent, styles.visualizationContainer)}>
          <div className={styles.headerBig}>
            <Text element="h2" textAlignment="center" weight="medium">
              <Trans i18nKey="dashboard.empty.add-visualization-header">
                Start your new dashboard by adding a visualization
              </Trans>
            </Text>
          </div>
          <div className={styles.bodyBig}>
            <Text element="p" textAlignment="center" color="secondary">
              <Trans i18nKey="dashboard.empty.add-visualization-body">
                Select a data source and then query and visualize your data with charts, stats and tables or create
                lists, markdowns and other widgets.
              </Trans>
            </Text>
          </div>
          <Button
            size="md"
            icon="plus"
            fill="outline"
            data-testid={selectors.pages.AddDashboard.itemButton('Create new panel button')}
            onClick={() => {
              const id = onCreateNewPanel(dashboard, initialDatasource);
              reportInteraction('dashboards_emptydashboard_clicked', { item: 'add_visualization' });
              locationService.partial({ editPanel: id, firstPanel: true });
              dispatch(setInitialDatasource(undefined));
            }}
            disabled={!canCreate}
          >
            <Trans i18nKey="dashboard.empty.add-visualization-button">Add visualization</Trans>
          </Button>
        </div>

        <div className={cx(styles.centeredContent, styles.others)}>
          {config.featureToggles.vizAndWidgetSplit && (
            <div className={cx(styles.containerBox, styles.centeredContent, styles.widgetContainer)}>
              <div className={styles.headerSmall}>
                <Text element="h3" textAlignment="center" weight="medium">
                  <Trans i18nKey="dashboard.empty.add-widget-header">Add a widget</Trans>
                </Text>
              </div>
              <div className={styles.bodySmall}>
                <Text element="p" textAlignment="center" color="secondary">
                  <Trans i18nKey="dashboard.empty.add-widget-body">Create lists, markdowns and other widgets</Trans>
                </Text>
              </div>
              <Button
                icon="plus"
                fill="outline"
                data-testid={selectors.pages.AddDashboard.itemButton('Create new widget button')}
                onClick={() => {
                  reportInteraction('dashboards_emptydashboard_clicked', { item: 'add_widget' });
                  locationService.partial({ addWidget: true });
                }}
                disabled={!canCreate}
              >
                <Trans i18nKey="dashboard.empty.add-widget-button">Add widget</Trans>
              </Button>
            </div>
          )}
          <div className={cx(styles.containerBox, styles.centeredContent, styles.rowContainer)}>
            <div className={styles.headerSmall}>
              <Text element="h3" textAlignment="center" weight="medium">
                <Trans i18nKey="dashboard.empty.add-row-header">Add a row</Trans>
              </Text>
            </div>
            <div className={styles.bodySmall}>
              <Text element="p" textAlignment="center" color="secondary">
                <Trans i18nKey="dashboard.empty.add-row-body">
                  Group your visualizations into expandable sections.
                </Trans>
              </Text>
            </div>
            <Button
              icon="plus"
              fill="outline"
              data-testid={selectors.pages.AddDashboard.itemButton('Create new row button')}
              onClick={() => {
                reportInteraction('dashboards_emptydashboard_clicked', { item: 'add_row' });
                onCreateNewRow(dashboard);
              }}
              disabled={!canCreate}
            >
              <Trans i18nKey="dashboard.empty.add-row-button">Add row</Trans>
            </Button>
          </div>
          <div className={cx(styles.containerBox, styles.centeredContent, styles.libraryContainer)}>
            <div className={styles.headerSmall}>
              <Text element="h3" textAlignment="center" weight="medium">
                <Trans i18nKey="dashboard.empty.add-import-header">Import panel</Trans>
              </Text>
            </div>
            <div className={styles.bodySmall}>
              <Text element="p" textAlignment="center" color="secondary">
                <Trans i18nKey="dashboard.empty.add-import-body">
                  Import visualizations that are shared with other dashboards.
                </Trans>
              </Text>
            </div>
            <Button
              icon="plus"
              fill="outline"
              data-testid={selectors.pages.AddDashboard.itemButton('Add a panel from the panel library button')}
              onClick={() => {
                reportInteraction('dashboards_emptydashboard_clicked', { item: 'import_from_library' });
                onAddLibraryPanel(dashboard);
              }}
              disabled={!canCreate}
            >
              <Trans i18nKey="dashboard.empty.add-import-button">Import library panel</Trans>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DashboardEmpty;

function getStyles(theme: GrafanaTheme2) {
  return {
    wrapper: css({
      label: 'dashboard-empty-wrapper',
      flexDirection: 'column',
      maxWidth: '890px',
      gap: theme.spacing.gridSize * 4,
      paddingTop: theme.spacing(2),

      [theme.breakpoints.up('sm')]: {
        paddingTop: theme.spacing(12),
      },
    }),
    containerBox: css({
      label: 'container-box',
      flexDirection: 'column',
      boxSizing: 'border-box',
      border: '1px dashed rgba(110, 159, 255, 0.5)',
      margin: 0,
    }),
    centeredContent: css({
      label: 'centered',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
    }),
    visualizationContainer: css({
      label: 'visualization-container',
      padding: theme.spacing.gridSize * 4,
    }),
    others: css({
      width: '100%',
      label: 'others-wrapper',
      alignItems: 'stretch',
      flexDirection: 'row',
      gap: theme.spacing.gridSize * 4,

      [theme.breakpoints.down('md')]: {
        flexDirection: 'column',
      },
    }),
    error: css`
      padding: 10px;
      border: 1px solid ${theme.colors.error.border};
    `,
    assistAIContainer: css({
      label: 'assist-ai-container',
      padding: theme.spacing.gridSize * 3,
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      width: '100%',
      backgroundImage: 'url(public/img/bg/DashboardsLines.svg)',
      backgroundRepeat: 'no-repeat',
      backgroundPosition: 'bottom',
    }),
    assistAIBody: css({
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: theme.spacing.gridSize * 2,
      position: 'relative',
    }),
    IAMGROT: css({
      position: 'absolute',
      left: '-225px',
    }),
    feedbackToUser: css({
      color: theme.colors.gradients.brandHorizontal,
      fontSize: theme.typography.size.md,
      textAlign: 'center',
      padding: theme.spacing.gridSize * 2,
    }),
    widgetContainer: css({
      label: 'widget-container',
      padding: theme.spacing.gridSize * 3,
      flex: 1,
    }),
    rowContainer: css({
      label: 'row-container',
      padding: theme.spacing.gridSize * 3,
      flex: 1,
    }),
    libraryContainer: css({
      label: 'library-container',
      padding: theme.spacing.gridSize * 3,
      flex: 1,
    }),
    headerBig: css({
      marginBottom: theme.spacing.gridSize * 2,
    }),
    headerSmall: css({
      marginBottom: theme.spacing.gridSize,
    }),
    bodyBig: css({
      maxWidth: '75%',
      marginBottom: theme.spacing.gridSize * 4,
    }),
    bodySmall: css({
      marginBottom: theme.spacing.gridSize * 3,
    }),
    loadingPlaceholder: css({
      marginBottom: 0,
    }),
    llmButtons: css({
      display: 'flex',
      flexDirection: 'row',
      gap: '10px',
    }),
  };
}
