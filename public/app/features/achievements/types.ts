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
  ConnectYourFirstDatasource = 'ConnectYourFirstDatasource',
  UseExploreToMakeAQuery = 'UseExploreToMakeAQuery',
  AddExplorePanelToADashboard = 'AddExplorePanelToADashboard',
  AddATitleAndDescriptionToAPanelInADashboard = 'AddATitleAndDescriptionToAPanelInADashboard',
  ChangeTheTheme = 'ChangeTheTheme',
  ExploreKeyboardShortcuts = 'ExploreKeyboardShortcuts',
  ChangePanelSettings = 'ChangePanelSettings',
  ImplementDataLink = 'ImplementDataLink',
  AddTemplateVariable = 'AddTemplateVariable',
  AddDataTransformation = 'AddDataTransformation',
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
  completed?: boolean;
};
