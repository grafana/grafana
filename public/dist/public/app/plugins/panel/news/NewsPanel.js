import React, { useEffect } from 'react';
import { RefreshEvent } from '@grafana/runtime';
import { Alert, CustomScrollbar, Icon } from '@grafana/ui';
import { News } from './component/News';
import { DEFAULT_FEED_URL } from './constants';
import { useNewsFeed } from './useNewsFeed';
export function NewsPanel(props) {
    const { width, options: { feedUrl = DEFAULT_FEED_URL, showImage }, } = props;
    const { state, getNews } = useNewsFeed(feedUrl);
    useEffect(() => {
        const sub = props.eventBus.subscribe(RefreshEvent, getNews);
        return () => {
            sub.unsubscribe();
        };
    }, [getNews, props.eventBus]);
    useEffect(() => {
        getNews();
    }, [getNews]);
    if (state.error) {
        return (React.createElement(Alert, { title: "Error loading RSS feed" },
            "Make sure that the feed URL is correct and that CORS is configured correctly on the server. See",
            ' ',
            React.createElement("a", { style: { textDecoration: 'underline' }, href: "https://grafana.com/docs/grafana/latest/panels-visualizations/visualizations/news/" },
                "News panel documentation. ",
                React.createElement(Icon, { name: "external-link-alt" }))));
    }
    if (state.loading) {
        return React.createElement("div", null, "Loading...");
    }
    if (!state.value) {
        return null;
    }
    return (React.createElement(CustomScrollbar, { autoHeightMin: "100%", autoHeightMax: "100%" }, state.value.map((_, index) => {
        return React.createElement(News, { key: index, index: index, width: width, showImage: showImage, data: state.value });
    })));
}
//# sourceMappingURL=NewsPanel.js.map