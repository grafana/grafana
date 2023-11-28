import memoize from 'micro-memoize';
/**
 * @public
 * @deprecated use useStyles hook
 *  Creates memoized version of styles creator
 * @param stylesCreator function accepting dependencies based on which styles are created
 */
export function stylesFactory(stylesCreator) {
    return memoize(stylesCreator);
}
//# sourceMappingURL=stylesFactory.js.map