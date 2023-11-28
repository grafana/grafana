import { __awaiter } from "tslib";
import { css } from '@emotion/css';
import React from 'react';
import { useAsync } from 'react-use';
import { selectors } from '@grafana/e2e-selectors';
import { getBackendSrv } from '@grafana/runtime';
import { Alert, Spinner, useStyles2 } from '@grafana/ui';
import config from 'app/core/config';
import { contextSrv } from '../../../../core/services/context_srv';
import impressionSrv from '../../../../core/services/impression_srv';
import { GENERAL_FOLDER_UID } from '../../constants';
import { getGrafanaSearcher } from '../../service';
import { getFolderChildren } from '../../service/folders';
import { queryResultToViewItem } from '../../service/utils';
import { FolderSection } from './FolderSection';
function getChildren() {
    return __awaiter(this, void 0, void 0, function* () {
        if (config.featureToggles.nestedFolders) {
            return getFolderChildren();
        }
        const searcher = getGrafanaSearcher();
        const results = yield searcher.search({
            query: '*',
            kind: ['folder'],
            sort: searcher.getFolderViewSort(),
            limit: 1000,
        });
        return results.view.map((v) => queryResultToViewItem(v, results.view));
    });
}
export const RootFolderView = ({ selection, selectionToggle, onTagSelected, tags, hidePseudoFolders, onClickItem, }) => {
    const styles = useStyles2(getStyles);
    const results = useAsync(() => __awaiter(void 0, void 0, void 0, function* () {
        const folders = yield getChildren();
        folders.unshift({ title: 'General', url: '/dashboards', kind: 'folder', uid: GENERAL_FOLDER_UID });
        if (!hidePseudoFolders) {
            const itemsUIDs = yield impressionSrv.getDashboardOpened();
            if (itemsUIDs.length) {
                folders.unshift({ title: 'Recent', icon: 'clock-nine', kind: 'folder', uid: '__recent', itemsUIDs });
            }
            if (contextSrv.isSignedIn) {
                const stars = yield getBackendSrv().get('api/user/stars');
                if (stars.length > 0) {
                    folders.unshift({ title: 'Starred', icon: 'star', kind: 'folder', uid: '__starred', itemsUIDs: stars });
                }
            }
        }
        return folders;
    }), []);
    const renderResults = () => {
        if (results.loading) {
            return React.createElement(Spinner, { className: styles.spinner });
        }
        else if (!results.value) {
            return React.createElement(Alert, { className: styles.error, title: results.error ? results.error.message : 'Something went wrong' });
        }
        else {
            return results.value.map((section) => (React.createElement("div", { "data-testid": selectors.components.Search.sectionV2, className: styles.section, key: section.title }, section.title && (React.createElement(FolderSection, { selection: selection, selectionToggle: selectionToggle, onTagSelected: onTagSelected, section: section, tags: tags, onClickItem: onClickItem })))));
        }
    };
    return React.createElement("div", { className: styles.wrapper }, renderResults());
};
const getStyles = (theme) => {
    return {
        wrapper: css `
      display: flex;
      flex-direction: column;
      overflow: auto;

      > ul {
        list-style: none;
      }

      border: solid 1px ${theme.v1.colors.border2};
    `,
        section: css `
      display: flex;
      flex-direction: column;
      background: ${theme.v1.colors.panelBg};

      &:not(:last-child) {
        border-bottom: solid 1px ${theme.v1.colors.border2};
      }
    `,
        spinner: css `
      align-items: center;
      display: flex;
      justify-content: center;
      min-height: 100px;
    `,
        error: css `
      margin: ${theme.spacing(4)} auto;
    `,
    };
};
//# sourceMappingURL=RootFolderView.js.map