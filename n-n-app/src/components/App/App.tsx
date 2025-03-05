import React from 'react';
import { SceneApp, useSceneApp } from '@grafana/scenes';
import { AppRootProps } from '@grafana/data';
import { config } from '@grafana/runtime';
import { Alert } from '@grafana/ui';
import { DATASOURCE_REF } from '../../constants';
import { PluginPropsContext } from '../../utils/utils.plugin';
import { helloWorldPage } from '../../pages/HelloWorld/helloWorldPage';
import { homePage } from '../../pages/Home/homePage';
import { withDrilldownPage } from '../../pages/WithDrilldown/withDrilldownPage';
import { withTabsPage } from '../../pages/WithTabs/withTabsPage';


import StockAnomalyDetector from '../../pages/StockAnomalyDetector';
import StockChart from 'pages/StockChart';

function getSceneApp() {
  return new SceneApp({
    pages: [helloWorldPage, homePage, withDrilldownPage, withTabsPage],
    urlSyncOptions: {
      updateUrlOnInit: true,
      createBrowserHistorySteps: true,
    },
  });
}

function AppWithScenes() {
  const scene = useSceneApp(getSceneApp);

  return (
    <>
      {!config.datasources[DATASOURCE_REF.uid] && (
        <Alert title={`Missing ${DATASOURCE_REF.uid} datasource`}>
          These demos depend on <b>testdata</b> datasource.
        </Alert>
      )}

      <scene.Component model={scene} />
      <StockChart /> {/* Add the new component here */}
      <StockAnomalyDetector /> {/* Add the new component here */}

    </>
  );
}

 
function App(props: AppRootProps) {
  return (
    <PluginPropsContext.Provider value={props}>
      <AppWithScenes />
    </PluginPropsContext.Provider>
  );
}

export default App;


//add commit