0. Call Plugin.OnSubscribe over survey.
1. Live.OnSubscribe NewPluginHandler Only plugins should call leaderManager
2. RunStream leaderManager to touch leader
3. Live.OnSubRefresh - only for plugins!
