import { css } from '@emotion/css';
import React from 'react';
import { Card, TagList, Tooltip, RenderUserContentAsHTML, useStyles2 } from '@grafana/ui';
export const AnnotationListItem = ({ options, annotation, formatDate, onClick, onAvatarClick, onTagClick }) => {
    const styles = useStyles2(getStyles);
    const { showUser, showTags, showTime } = options;
    const { text = '', login, email, avatarUrl, tags, time, timeEnd } = annotation;
    const onItemClick = () => {
        onClick(annotation);
    };
    const onLoginClick = () => {
        onAvatarClick(annotation);
    };
    const showAvatar = login && showUser;
    const showTimeStamp = time && showTime;
    const showTimeStampEnd = timeEnd && timeEnd !== time && showTime;
    return (React.createElement(Card, { className: styles.card, onClick: onItemClick },
        React.createElement(Card.Heading, null,
            React.createElement(RenderUserContentAsHTML, { className: styles.heading, onClick: (e) => {
                    e.stopPropagation();
                }, content: text })),
        showTimeStamp && (React.createElement(Card.Description, { className: styles.timestamp },
            React.createElement(TimeStamp, { formatDate: formatDate, time: time }),
            showTimeStampEnd && (React.createElement(React.Fragment, null,
                React.createElement("span", { className: styles.time }, "-"),
                React.createElement(TimeStamp, { formatDate: formatDate, time: timeEnd }),
                ' ')))),
        showAvatar && (React.createElement(Card.Meta, { className: styles.meta },
            React.createElement(Avatar, { email: email, login: login, avatarUrl: avatarUrl, onClick: onLoginClick }))),
        showTags && tags && (React.createElement(Card.Tags, null,
            React.createElement(TagList, { tags: tags, onClick: (tag) => onTagClick(tag, false) })))));
};
const Avatar = ({ onClick, avatarUrl, login, email }) => {
    const styles = useStyles2(getStyles);
    const onAvatarClick = (e) => {
        e.stopPropagation();
        onClick();
    };
    const tooltipContent = (React.createElement("span", null,
        "Created by:",
        React.createElement("br", null),
        " ",
        email));
    return (React.createElement(Tooltip, { content: tooltipContent, theme: "info", placement: "top" },
        React.createElement("button", { onClick: onAvatarClick, className: styles.avatar, "aria-label": `Created by ${email}` },
            React.createElement("img", { src: avatarUrl, alt: "avatar icon" }))));
};
const TimeStamp = ({ time, formatDate }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement("span", { className: styles.time },
        React.createElement("span", null, formatDate(time))));
};
function getStyles(theme) {
    return {
        card: css({
            gridTemplateAreas: `"Heading Description Meta Tags"`,
            gridTemplateColumns: 'auto 1fr auto auto',
            padding: theme.spacing(1),
            margin: theme.spacing(0.5),
            width: 'inherit',
        }),
        heading: css({
            a: {
                zIndex: 1,
                position: 'relative',
                color: theme.colors.text.link,
                '&:hover': {
                    textDecoration: 'underline',
                },
            },
        }),
        meta: css({
            margin: 0,
            position: 'relative',
            justifyContent: 'end',
        }),
        timestamp: css({
            margin: 0,
            alignSelf: 'center',
        }),
        time: css({
            marginLeft: theme.spacing(1),
            marginRight: theme.spacing(1),
            fontSize: theme.typography.bodySmall.fontSize,
            color: theme.colors.text.secondary,
        }),
        avatar: css({
            border: 'none',
            background: 'inherit',
            margin: 0,
            padding: theme.spacing(0.5),
            img: {
                borderRadius: theme.shape.radius.circle,
                width: theme.spacing(2),
                height: theme.spacing(2),
            },
        }),
    };
}
//# sourceMappingURL=AnnotationListItem.js.map