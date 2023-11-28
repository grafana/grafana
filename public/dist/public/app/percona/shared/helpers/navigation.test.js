import { sortWithSubsections } from './navigation';
describe('NavigationUtils', () => {
    describe('sortWithSubsections', () => {
        it("doesn't modify if there aren't subheaders", () => {
            const items = [
                {
                    text: 'Item #1',
                },
                {
                    text: 'Item #2',
                },
            ];
            expect(sortWithSubsections(items)).toStrictEqual(items);
        });
        it('sorts with two subsections without headers', () => {
            const items = [
                {
                    text: 'Item #1',
                },
                {
                    text: '',
                    divider: true,
                },
                {
                    text: 'Item #2',
                },
            ];
            expect(sortWithSubsections(items)).toStrictEqual(items);
        });
        it('sorts with two subsections with headers', () => {
            const items = [
                {
                    text: 'Item #1',
                },
                {
                    text: 'Header #1',
                    isSubheader: true,
                },
                {
                    text: '',
                    divider: true,
                },
                {
                    text: 'Header #2',
                    isSubheader: true,
                },
                {
                    text: 'Item #2',
                },
            ];
            const expected = [
                {
                    text: 'Header #1',
                    isSubheader: true,
                },
                {
                    text: 'Item #1',
                },
                {
                    text: '',
                    divider: true,
                },
                {
                    text: 'Header #2',
                    isSubheader: true,
                },
                {
                    text: 'Item #2',
                },
            ];
            expect(sortWithSubsections(items)).toStrictEqual(expected);
        });
        it('sorts with three subsections with headers', () => {
            const items = [
                {
                    text: 'Item #1',
                },
                {
                    text: 'Header #1',
                    isSubheader: true,
                },
                {
                    text: '',
                    divider: true,
                },
                {
                    text: 'Header #2',
                    isSubheader: true,
                },
                {
                    text: '',
                    divider: true,
                },
                {
                    text: 'Item #3',
                },
                {
                    text: 'Header #3',
                    isSubheader: true,
                },
            ];
            const expected = [
                {
                    text: 'Header #1',
                    isSubheader: true,
                },
                {
                    text: 'Item #1',
                },
                {
                    text: '',
                    divider: true,
                },
                {
                    text: 'Header #2',
                    isSubheader: true,
                },
                {
                    text: '',
                    divider: true,
                },
                {
                    text: 'Header #3',
                    isSubheader: true,
                },
                {
                    text: 'Item #3',
                },
            ];
            expect(sortWithSubsections(items)).toStrictEqual(expected);
        });
    });
});
//# sourceMappingURL=navigation.test.js.map