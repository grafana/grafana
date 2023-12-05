export enum AchievementLevel {
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
  AddDataTransformation = 'AddDataTransformation', // stopping point for today
  AddCanvasVisualization = 'AddCanvasVisualization',
  AddMetricValueElement = 'AddMetricValueElement',
  EnableCrosshairSharing = 'EnableCrosshairSharing',
  LegendChangeSeriesColor = 'LegendChangeSeriesColor',
  LegendShowSeries = 'LegendShowSeries',
  LegendHideSeries = 'LegendHideSeries',
  AddCustomThresholds = 'AddCustomThresholds',
  AddValueMapping = 'AddValueMapping',
  AddAdvancedDataLink = 'AddAdvancedDataLink',
  UseOuterJoinTransformation = 'UseOuterJoinTransformation',
  MakePublicDashboard = 'MakePublicDashboard',
  StreamDataToGrafana = 'StreamDataToGrafana',
}

export type Achievement = {
  id: AchievementId;
  title: string;
  description?: string;
  level: AchievementLevel;
  link?: string;
  video?: string;
  completed?: boolean;
};
