import { css } from '@emotion/css';
import React, { useState } from 'react';
import { Button, Dropdown, Icon, IconButton, Menu, Modal, useStyles2 } from '@grafana/ui';
import { trackInsightsFeedback } from '../Analytics';
export function InsightsRatingModal({ panel }) {
    const styles = useStyles2(getStyles);
    const [showModal, setShowModal] = useState(false);
    const onDismiss = () => {
        setShowModal(false);
    };
    const onButtonClick = (useful) => {
        trackInsightsFeedback({ useful, panel: panel });
        onDismiss();
    };
    const modal = (React.createElement(Modal, { title: "Rate this panel", isOpen: showModal, onDismiss: onDismiss, onClickBackdrop: onDismiss, className: styles.container },
        React.createElement("div", null,
            React.createElement("p", null, "Help us improve this page by telling us whether this panel is useful to you!"),
            React.createElement("div", { className: styles.buttonsContainer },
                React.createElement(Button, { variant: "secondary", className: styles.buttonContainer, onClick: () => onButtonClick(false) },
                    React.createElement("div", { className: styles.button },
                        React.createElement(Icon, { name: "thumbs-up", className: styles.thumbsdown, size: "xxxl" }),
                        React.createElement("span", null, `I don't like it`))),
                React.createElement(Button, { variant: "secondary", className: styles.buttonContainer, onClick: () => onButtonClick(true) },
                    React.createElement("div", { className: styles.button },
                        React.createElement(Icon, { name: "thumbs-up", size: "xxxl" }),
                        React.createElement("span", null, "I like it")))))));
    const menu = (React.createElement(Menu, null,
        React.createElement(Menu.Item, { label: "Rate this panel", icon: "comment-alt-message", onClick: () => setShowModal(true) })));
    return (React.createElement("div", null,
        React.createElement(Dropdown, { overlay: menu, placement: "bottom-start" },
            React.createElement(IconButton, { name: "ellipsis-v", variant: "secondary", className: styles.menu, "aria-label": "Rate this panel" })),
        modal));
}
const getStyles = (theme) => ({
    buttonsContainer: css({
        display: 'flex',
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'stretch',
        gap: '25px',
    }),
    buttonContainer: css({
        height: '150px',
        width: '150px',
        cursor: 'pointer',
        justifyContent: 'center',
    }),
    button: css({
        display: 'flex',
        flexDirection: 'column',
    }),
    container: css({
        maxWidth: '370px',
    }),
    menu: css({
        height: '25px',
        margin: '0',
    }),
    thumbsdown: css({
        transform: 'scale(-1, -1);',
    }),
});
//# sourceMappingURL=RatingModal.js.map