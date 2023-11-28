// Libraries
import React from 'react';
import { useAsync } from 'react-use';
import { Stack } from '@grafana/experimental';
import { Card } from '@grafana/ui';
import { Page } from 'app/core/components/Page/Page';
// Types
import { getGrafanaSearcher } from '../search/service';
import { getScenes } from './scenes';
export const SceneListPage = ({}) => {
    const scenes = getScenes();
    const results = useAsync(() => {
        return getGrafanaSearcher().starred({ starred: true });
    }, []);
    return (React.createElement(Page, { navId: "scenes", subTitle: "Experimental new runtime and state model for dashboards" },
        React.createElement(Page.Contents, null,
            React.createElement(Stack, { direction: "column", gap: 1 },
                React.createElement("h5", null, "Apps"),
                React.createElement(Stack, { direction: "column", gap: 0 },
                    React.createElement(Card, { href: `/scenes/grafana-monitoring` },
                        React.createElement(Card.Heading, null, "Grafana monitoring"))),
                React.createElement("h5", null, "Test scenes"),
                React.createElement(Stack, { direction: "column", gap: 0 }, scenes.map((scene) => (React.createElement(Card, { key: scene.title, href: `/scenes/${scene.title}` },
                    React.createElement(Card.Heading, null, scene.title))))),
                results.value && (React.createElement(React.Fragment, null,
                    React.createElement("h5", null, "Starred dashboards"),
                    React.createElement(Stack, { direction: "column", gap: 0 }, results.value.view.map((dash) => (React.createElement(Card, { href: `/scenes/dashboard/${dash.uid}`, key: dash.uid },
                        React.createElement(Card.Heading, null, dash.name)))))))))));
};
export default SceneListPage;
//# sourceMappingURL=SceneListPage.js.map