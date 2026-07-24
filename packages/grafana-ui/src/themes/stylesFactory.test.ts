import { stylesFactory } from './stylesFactory';

interface FakeProps {
  theme: {
    a: string;
  };
}
describe('Stylesheet creation', () => {
  it('memoizes results', () => {
    const spy = jest.fn();

    const getStyles = stylesFactory(({ theme }: FakeProps) => {
      spy();
      return {
        className: `someClass${theme.a}`,
      };
    });

    const props: FakeProps = { theme: { a: '-interpolated' } };
    const changedProps: FakeProps = { theme: { a: '-interpolatedChanged' } };
    const styles = getStyles(props);
    getStyles(props);

    expect(spy).toBeCalledTimes(1);
    expect(styles.className).toBe('someClass-interpolated');

    const styles2 = getStyles(changedProps);
    expect(spy).toBeCalledTimes(2);
    expect(styles2.className).toBe('someClass-interpolatedChanged');
  });
});
