import { css } from '@emotion/css';
import React from 'react';
import { Button, Card, LinkButton, ModalsController, useStyles2 } from '@grafana/ui';
import { t, Trans } from 'app/core/internationalization';
import { contextSrv } from 'app/core/services/context_srv';
import { DashNavButton } from 'app/features/dashboard/components/DashNav/DashNavButton';
import { ShareModal } from './ShareModal';
export const PlaylistPageList = ({ playlists, setStartPlaylist, setPlaylistToDelete }) => {
    const styles = useStyles2(getStyles);
    return (React.createElement("ul", { className: styles.list }, playlists.map((playlist) => (React.createElement("li", { className: styles.listItem, key: playlist.uid },
        React.createElement(Card, null,
            React.createElement(Card.Heading, null,
                playlist.name,
                React.createElement(ModalsController, { key: "button-share" }, ({ showModal, hideModal }) => (React.createElement(DashNavButton, { tooltip: t('playlist-page.card.tooltip', 'Share playlist'), icon: "share-alt", iconSize: "lg", onClick: () => {
                        showModal(ShareModal, {
                            playlistUid: playlist.uid,
                            onDismiss: hideModal,
                        });
                    } })))),
            React.createElement(Card.Actions, null,
                React.createElement(Button, { variant: "secondary", icon: "play", onClick: () => setStartPlaylist(playlist) },
                    React.createElement(Trans, { i18nKey: "playlist-page.card.start" }, "Start playlist")),
                contextSrv.isEditor && (React.createElement(React.Fragment, null,
                    React.createElement(LinkButton, { key: "edit", variant: "secondary", href: `/playlists/edit/${playlist.uid}`, icon: "cog" },
                        React.createElement(Trans, { i18nKey: "playlist-page.card.edit" }, "Edit playlist")),
                    React.createElement(Button, { disabled: false, onClick: () => setPlaylistToDelete(playlist), icon: "trash-alt", variant: "destructive" },
                        React.createElement(Trans, { i18nKey: "playlist-page.card.delete" }, "Delete playlist")))))))))));
};
function getStyles(theme) {
    return {
        list: css({
            display: 'grid',
        }),
        listItem: css({
            listStyle: 'none',
        }),
    };
}
//# sourceMappingURL=PlaylistPageList.js.map