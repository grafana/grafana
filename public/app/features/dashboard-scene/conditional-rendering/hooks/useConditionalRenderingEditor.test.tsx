import { act, render, screen } from '@testing-library/react';

import { ConditionalRenderingGroup } from '../group/ConditionalRenderingGroup';

import { useConditionalRenderingEditor } from './useConditionalRenderingEditor';

describe('useConditionalRenderingEditor', () => {
  // OptionsPaneCategory calls renderTitle during its own render, and the React Compiler may skip
  // that call between renders. Calling it outside a render here fails if it runs a hook itself.
  it('renderTitle returns an element whose eye icon follows the rules result', () => {
    const conditionalRendering = ConditionalRenderingGroup.createEmpty();
    const category = useConditionalRenderingEditor(conditionalRendering);

    render(<>{category.props.renderTitle!(true)}</>);

    expect(screen.getByText('Show / hide rules')).toBeInTheDocument();
    expect(screen.getByTestId('icon-eye')).toBeInTheDocument();

    act(() => conditionalRendering.setState({ result: false }));

    expect(screen.getByTestId('icon-eye-slash')).toBeInTheDocument();
    expect(screen.queryByTestId('icon-eye')).not.toBeInTheDocument();
  });
});
