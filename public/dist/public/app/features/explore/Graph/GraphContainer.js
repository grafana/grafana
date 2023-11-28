import { css } from '@emotion/css';
import React, { useCallback, useMemo, useState } from 'react';
import { useToggle } from 'react-use';
import { PanelChrome, Icon, Button, useStyles2, Tooltip, } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { storeGraphStyle } from '../state/utils';
import { ExploreGraph } from './ExploreGraph';
import { ExploreGraphLabel } from './ExploreGraphLabel';
import { loadGraphStyle } from './utils';
const MAX_NUMBER_OF_TIME_SERIES = 20;
export const GraphContainer = ({ data, eventBus, height, width, absoluteRange, timeZone, annotations, onChangeTime, splitOpenFn, thresholdsConfig, thresholdsStyle, loadingState, statusMessage, }) => {
    const [showAllSeries, toggleShowAllSeries] = useToggle(false);
    const [graphStyle, setGraphStyle] = useState(loadGraphStyle);
    const styles = useStyles2(getStyles);
    const onGraphStyleChange = useCallback((graphStyle) => {
        storeGraphStyle(graphStyle);
        setGraphStyle(graphStyle);
    }, []);
    const slicedData = useMemo(() => {
        return showAllSeries ? data : data.slice(0, MAX_NUMBER_OF_TIME_SERIES);
    }, [data, showAllSeries]);
    return (React.createElement(PanelChrome, { title: t('graph.container.title', 'Graph'), titleItems: [
            !showAllSeries && MAX_NUMBER_OF_TIME_SERIES < data.length && (React.createElement("div", { key: "disclaimer", className: styles.timeSeriesDisclaimer },
                React.createElement("span", { className: styles.warningMessage },
                    React.createElement(Icon, { name: "exclamation-triangle", "aria-hidden": "true" }),
                    React.createElement(Trans, { i18nKey: 'graph.container.show-only-series' },
                        "Showing only ",
                        { MAX_NUMBER_OF_TIME_SERIES },
                        " series")),
                React.createElement(Tooltip, { content: t('graph.container.content', 'Rendering too many series in a single panel may impact performance and make data harder to read. Consider refining your queries.') },
                    React.createElement(Button, { variant: "secondary", size: "sm", onClick: toggleShowAllSeries },
                        React.createElement(Trans, { i18nKey: 'graph.container.show-all-series' },
                            "Show all ",
                            { length: data.length }))))),
        ].filter(Boolean), width: width, height: height, loadingState: loadingState, statusMessage: statusMessage, actions: React.createElement(ExploreGraphLabel, { graphStyle: graphStyle, onChangeGraphStyle: onGraphStyleChange }) }, (innerWidth, innerHeight) => (React.createElement(ExploreGraph, { graphStyle: graphStyle, data: slicedData, height: innerHeight, width: innerWidth, absoluteRange: absoluteRange, onChangeTime: onChangeTime, timeZone: timeZone, annotations: annotations, splitOpenFn: splitOpenFn, loadingState: loadingState, thresholdsConfig: thresholdsConfig, thresholdsStyle: thresholdsStyle, eventBus: eventBus }))));
};
const getStyles = (theme) => ({
    timeSeriesDisclaimer: css({
        label: 'time-series-disclaimer',
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing(1),
    }),
    warningMessage: css({
        display: 'flex',
        alignItems: 'center',
        gap: theme.spacing(0.5),
        color: theme.colors.warning.main,
        fontSize: theme.typography.bodySmall.fontSize,
    }),
});
//# sourceMappingURL=GraphContainer.js.map