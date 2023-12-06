import { IconName } from '@grafana/data';

export enum AchievementLevel {
  Egg = 0,
  Novice = 1,
  Beginner = 2,
  Experienced = 3,
  Expert = 4,
  Wizard = 5,
}

export enum AchievementId {
  NavigateToDashboard = 'NavigateToDashboard', // DONE
  NavigateToExplore = 'NavigateToExplore', // DONE
  WatchIntroToGrafanaVideo = 'WatchIntroToGrafanaVideo', // TBD by achievements page
  ConnectYourFirstDatasource = 'ConnectYourFirstDatasource', // DONE
  UseExploreToMakeAQuery = 'UseExploreToMakeAQuery', // DONE
  AddExplorePanelToADashboard = 'AddExplorePanelToADashboard', // DONE
  AddATitleToAPanelInADashboard = 'AddATitleToAPanelInADashboard', // DONE
  AddADescriptionToAPanelInADashboard = 'AddADescriptionToAPanelInADashboard', // DONE
  ChangeTheTheme = 'ChangeTheTheme', // DONE
  ExploreKeyboardShortcuts = 'ExploreKeyboardShortcuts', // DONE
  ChangePanelSettings = 'ChangePanelSettings', // SKIP (not sure how to best implement this)
  ImplementDataLink = 'ImplementDataLink', // SKIP pain due to code being in grafana UI package
  AddTemplateVariable = 'AddTemplateVariable', // DONE
  BrowseDataTransformations = 'BrowseDataTransformations', // DONE
  AddCanvasVisualization = 'AddCanvasVisualization', // DONE
  SetMetricValueElement = 'SetMetricValueElement', // DONE
  EnableSharedCrosshairOrTooltip = 'EnableSharedCrosshairOrTooltip', // DONE
  LegendChangeSeriesColor = 'LegendChangeSeriesColor', // SKIP pain due to code being in grafana UI package
  LegendShowSeries = 'LegendShowSeries', // SKIP pain due to code being in grafana UI package
  LegendHideSeries = 'LegendHideSeries', // SKIP pain due to code being in grafana UI package
  AddCustomThresholds = 'AddCustomThresholds', // DONE
  AddValueMapping = 'AddValueMapping', // DONE (awarded when opening up modal not on completion but good enough for demo)
  AddAdvancedDataLink = 'AddAdvancedDataLink', // SKIP pain due to code being in grafana UI package
  UseJoinByFieldTransformation = 'UseJoinByFieldTransformation', // DONE
  MakePublicDashboard = 'MakePublicDashboard', // DONE
  StreamDataToGrafana = 'StreamDataToGrafana', // SKIPPED: THIS ONE IS MORE COMPLEX (code is in grafana data package)
}

export type Achievement = {
  id: AchievementId;
  title: string;
  description?: string;
  level: AchievementLevel;
  link?: string;
  video?: string;
  completed?: boolean;
  icon?: IconName;
};
