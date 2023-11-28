export function getExceptionNav(error) {
    console.error(error);
    return getWarningNav('Exception thrown', 'See console for details');
}
export function getNotFoundNav() {
    return getWarningNav('Page not found', '404 Error');
}
export function getWarningNav(text, subTitle) {
    const node = {
        text,
        subTitle,
        icon: 'exclamation-triangle',
    };
    return {
        node: node,
        main: node,
    };
}
//# sourceMappingURL=errorModels.js.map