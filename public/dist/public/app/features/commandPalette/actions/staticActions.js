import { enrichHelpItem } from 'app/core/components/AppChrome/MegaMenu/utils';
import { t } from 'app/core/internationalization';
import { changeTheme } from 'app/core/services/theme';
import { ACTIONS_PRIORITY, DEFAULT_PRIORITY, PREFERENCES_PRIORITY } from '../values';
// TODO: Clean this once ID is mandatory on nav items
function idForNavItem(navItem) {
    var _a, _b, _c;
    return (_c = (_b = (_a = 'navModel.' + navItem.id) !== null && _a !== void 0 ? _a : navItem.url) !== null && _b !== void 0 ? _b : navItem.text) !== null && _c !== void 0 ? _c : navItem.subTitle;
}
function navTreeToActions(navTree, parents = []) {
    const navActions = [];
    for (let navItem of navTree) {
        // help node needs enriching with the frontend links
        if (navItem.id === 'help') {
            navItem = enrichHelpItem(Object.assign({}, navItem));
            delete navItem.url;
        }
        const { url, target, text, isCreateAction, children, onClick } = navItem;
        const hasChildren = Boolean(children === null || children === void 0 ? void 0 : children.length);
        if (!(url || onClick || hasChildren)) {
            continue;
        }
        const section = isCreateAction
            ? t('command-palette.section.actions', 'Actions')
            : t('command-palette.section.pages', 'Pages');
        const priority = isCreateAction ? ACTIONS_PRIORITY : DEFAULT_PRIORITY;
        const subtitle = parents.map((parent) => parent.text).join(' > ');
        const action = {
            id: idForNavItem(navItem),
            name: text,
            section: section,
            url,
            target,
            parent: parents.length > 0 && !isCreateAction ? idForNavItem(parents[parents.length - 1]) : undefined,
            perform: onClick,
            priority: priority,
            subtitle: isCreateAction ? undefined : subtitle,
        };
        navActions.push(action);
        if (children === null || children === void 0 ? void 0 : children.length) {
            const childActions = navTreeToActions(children, [...parents, navItem]);
            navActions.push(...childActions);
        }
    }
    return navActions;
}
export default (navBarTree) => {
    const globalActions = [
        {
            id: 'preferences/theme',
            name: t('command-palette.action.change-theme', 'Change theme...'),
            keywords: 'interface color dark light',
            section: t('command-palette.section.preferences', 'Preferences'),
            priority: PREFERENCES_PRIORITY,
        },
        {
            id: 'preferences/dark-theme',
            name: t('command-palette.action.dark-theme', 'Dark'),
            keywords: 'dark theme',
            perform: () => changeTheme('dark'),
            parent: 'preferences/theme',
            priority: PREFERENCES_PRIORITY,
        },
        {
            id: 'preferences/light-theme',
            name: t('command-palette.action.light-theme', 'Light'),
            keywords: 'light theme',
            perform: () => changeTheme('light'),
            parent: 'preferences/theme',
            priority: PREFERENCES_PRIORITY,
        },
    ];
    const navBarActions = navTreeToActions(navBarTree);
    return [...globalActions, ...navBarActions];
};
//# sourceMappingURL=staticActions.js.map