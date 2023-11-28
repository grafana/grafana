import { css } from '@emotion/css';
import React, { useEffect } from 'react';
import { useMeasure } from 'react-use';
import { LoadingPlaceholder, useStyles2 } from '@grafana/ui';
import { News } from 'app/plugins/panel/news/component/News';
import { useNewsFeed } from 'app/plugins/panel/news/useNewsFeed';
export function NewsWrapper({ feedUrl }) {
    const styles = useStyles2(getStyles);
    const { state, getNews } = useNewsFeed(feedUrl);
    const [widthRef, widthMeasure] = useMeasure();
    useEffect(() => {
        getNews();
    }, [getNews]);
    if (state.loading || state.error) {
        return (React.createElement("div", { className: styles.innerWrapper },
            state.loading && React.createElement(LoadingPlaceholder, { text: "Loading..." }),
            state.error && state.error.message));
    }
    if (!state.value) {
        return null;
    }
    return (React.createElement("div", { ref: widthRef },
        widthMeasure.width > 0 &&
            state.value.map((_, index) => (React.createElement(News, { key: index, index: index, showImage: true, width: widthMeasure.width, data: state.value }))),
        React.createElement("div", { className: styles.grot },
            React.createElement("a", { href: "https://grafana.com/blog/", target: "_blank", rel: "noreferrer", title: "Go to Grafana labs blog" },
                React.createElement("img", { src: "public/img/grot-news.svg", alt: "Grot reading news" })))));
}
const getStyles = (theme) => {
    return {
        innerWrapper: css({
            width: '100%',
            height: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
        }),
        grot: css({
            display: `flex`,
            alignItems: `center`,
            justifyContent: `center`,
            padding: theme.spacing(5, 0),
            img: {
                width: `186px`,
                height: `186px`,
            },
        }),
    };
};
//# sourceMappingURL=NewsWrapper.js.map