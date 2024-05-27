import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { MergeRowsMenu, MergeRowsMenuProps } from './MergeRowsMenu';

import {DashboardModel, PanelModel} from "../state";

describe('MergeRowsMenu ', () => {
  let panel1: PanelModel, panel2: PanelModel, panel3: PanelModel, panel4: PanelModel;
  let draggedRowPanel: PanelModel, otherRowPanel: PanelModel;
  let mockPanelMap: {[p: string]: PanelModel};
  let defaultProps: MergeRowsMenuProps;

  beforeEach(() => {
    jest.clearAllMocks();

    panel1 = new PanelModel({
      id: 3,
      title: 'Panel 1',
    });
    panel2 = new PanelModel({
      id: 4,
      title: 'Panel 2',
    });
    panel3 = new PanelModel({
      id: 5,
      title: 'Panel 3',
    });
    panel4 = new PanelModel({
      id: 6,
      title: 'Panel 4',
    });

    draggedRowPanel = new PanelModel({
      id: 1,
      title: 'DraggedTitleRow',
      type: 'row',
      gridPos: { x: 0, y: 0, w: 3, h: 1 },
      panels: [panel1, panel2],
      collapsed: true,
    });
    otherRowPanel = new PanelModel({
      id: 2,
      title: 'OtherTitleRow',
      type: 'row',
      gridPos: { x: 0, y: 1, w: 3, h: 1 },
      panels: [panel3, panel4],
      collapsed: true,
    });

    mockPanelMap = {
      '1': draggedRowPanel,
      '2': otherRowPanel,
    };

    let dashboardMock= {} as DashboardModel;
    dashboardMock.removeRow = jest.fn();

    defaultProps = {
      panelMap: mockPanelMap,
      draggedItem: { i: '1', x: 0, y: 0, w: 3, h: 1 },
      otherItem: { i: '2', x: 0, y: 1, w: 3, h: 1 },
      isMenuOpen: true,
      onClose: jest.fn(),
      dashboard: dashboardMock,
    };
  });

  it('Should render the modal title when isMenuOpen is true', () => {
    render(<MergeRowsMenu {...defaultProps} isMenuOpen={true} />);

    expect(screen.getByText('Merge Rows')).toBeInTheDocument();
  });

  it('Should not render the modal title when isMenuOpen is false', () => {
    render(<MergeRowsMenu {...defaultProps} isMenuOpen={false} />);

    expect(screen.queryByText('Merge Rows')).not.toBeInTheDocument();
  });

  it('Should render the panels from the dragged row', () => {
    render(<MergeRowsMenu {...defaultProps} isMenuOpen={true} />);

    expect(screen.getByText('Panel 1')).toBeInTheDocument();
    expect(screen.getByText('Panel 2')).toBeInTheDocument();

    const draggedRowColumn = screen.getByTestId('MergeRowsMenu-dragged-row');
    expect(draggedRowColumn).toHaveTextContent('Panel 1');
    expect(draggedRowColumn).toHaveTextContent('Panel 2');
  });

  it('Should render the panels from the other row', () => {
    render(<MergeRowsMenu {...defaultProps} isMenuOpen={true} />);

    expect(screen.getByText('Panel 3')).toBeInTheDocument();
    expect(screen.getByText('Panel 4')).toBeInTheDocument();

    const otherRowColumn = screen.getByTestId('MergeRowsMenu-other-row');
    expect(otherRowColumn).toHaveTextContent('Panel 3');
    expect(otherRowColumn).toHaveTextContent('Panel 4');
  });

  it('Should call onClose when the Merge button is clicked', () => {
    render(<MergeRowsMenu {...defaultProps} isMenuOpen={true} />);

    fireEvent.click(screen.getByText('Merge'));

    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('Should handle panel selection correctly', () => {
    render(<MergeRowsMenu {...defaultProps} isMenuOpen={true} />);

    fireEvent.click(screen.getByText('Panel 1'));
    expect(screen.getByText('Panel 1')).toBeInTheDocument();

    fireEvent.click(screen.getByText('Panel 3'));
    expect(screen.getByText('Panel 3')).toBeInTheDocument();

    const draggedRowColumn = screen.getByTestId('MergeRowsMenu-dragged-row');
    expect(draggedRowColumn).toHaveTextContent('Panel 2');
    expect(draggedRowColumn).toHaveTextContent('Panel 3');
    const otherRowColumn = screen.getByTestId('MergeRowsMenu-other-row');
    expect(otherRowColumn).toHaveTextContent('Panel 4');
    expect(otherRowColumn).toHaveTextContent('Panel 1');

    fireEvent.click(screen.getByText('Merge'));

    expect(draggedRowPanel.panels).toContain(panel2);
    expect(draggedRowPanel.panels).toContain(panel3);
    expect(otherRowPanel.panels).toContain(panel4);
    expect(otherRowPanel.panels).toContain(panel1);
  });

  it('Should render a special case menu when the dragged row and the other row have no panels', () => {
    let draggedRowPanelNoPanels = new PanelModel({
      id: 1,
      title: 'DraggedTitleRow',
      type: 'row',
      gridPos: { x: 0, y: 0, w: 3, h: 1 },
      panels: [],
      collapsed: true,
    });
    let otherRowPanelNoPanels = new PanelModel({
      id: 2,
      title: 'OtherTitleRow',
      type: 'row',
      gridPos: { x: 0, y: 1, w: 3, h: 1 },
      panels: [],
      collapsed: true,
    });

    const noPanelsMockMap = {
      '1': draggedRowPanelNoPanels,
      '2': otherRowPanelNoPanels,
    };
    const noPanelsProps = {
      ...defaultProps,
      panelMap: noPanelsMockMap,
    };

    render(<MergeRowsMenu {...noPanelsProps} isMenuOpen={true} />);

    expect(screen.getByText('The rows have no panels to merge')).toBeInTheDocument();
  });

  it('Should render a special case menu when the other row is not collapsed', () => {
    let draggedRowPanelNoPanels = new PanelModel({
      id: 1,
      title: 'DraggedTitleRow',
      type: 'row',
      gridPos: { x: 0, y: 0, w: 3, h: 1 },
      panels: [panel3, panel4],
      collapsed: true,
    });
    let otherRowPanelNoPanels = new PanelModel({
      id: 2,
      title: 'OtherTitleRow',
      type: 'row',
      gridPos: { x: 0, y: 1, w: 3, h: 1 },
      collapsed: false,
    });

    const noPanelsMockMap = {
      '1': draggedRowPanelNoPanels,
      '2': otherRowPanelNoPanels,
    };
    const noPanelsProps = {
      ...defaultProps,
      panelMap: noPanelsMockMap,
    };

    render(<MergeRowsMenu {...noPanelsProps} isMenuOpen={true} />);

    expect(screen.getByText('The item you have tried to drag into is not a collapse row')).toBeInTheDocument();
  });

  it('Should render a special case menu when the row is dragged into a panel that is not a row', () => {
    let draggedRowPanelNoPanels = new PanelModel({
      id: 1,
      title: 'DraggedTitleRow',
      type: 'row',
      gridPos: { x: 0, y: 0, w: 3, h: 1 },
      panels: [panel3, panel4],
      collapsed: true,
    });
    let otherRowPanelNoPanels = new PanelModel({
      id: 2,
      title: 'OtherTitleRow',
      gridPos: { x: 0, y: 1, w: 3, h: 2 },
    });

    const noPanelsMockMap = {
      '1': draggedRowPanelNoPanels,
      '2': otherRowPanelNoPanels,
    };
    const noPanelsProps = {
      ...defaultProps,
      panelMap: noPanelsMockMap,
    };

    render(<MergeRowsMenu {...noPanelsProps} isMenuOpen={true} />);

    expect(screen.getByText('The item you have tried to drag into is not a collapse row')).toBeInTheDocument();
  });

  it('Should open the confirm row delete menu if the dragged row has no panels left', () => {
    render(<MergeRowsMenu {...defaultProps} isMenuOpen={true} />);

    fireEvent.click(screen.getByText('Panel 1'));
    fireEvent.click(screen.getByText('Panel 2'));

    fireEvent.click(screen.getByText('Merge'));
    expect(draggedRowPanel.panels).toHaveLength(0);

    expect(screen.getByText('Confirm Row Delete')).toBeInTheDocument();
  });

  it('Should open the confirm row delete menu if the other row has no panels left', () => {
    render(<MergeRowsMenu {...defaultProps} isMenuOpen={true} />);

    fireEvent.click(screen.getByText('Panel 3'));
    fireEvent.click(screen.getByText('Panel 4'));

    fireEvent.click(screen.getByText('Merge'));
    expect(otherRowPanel.panels).toHaveLength(0);

    expect(screen.getByText('Confirm Row Delete')).toBeInTheDocument();
  });

  it('Should close the confirm row delete menu and call removeRow if the delete button is clicked', () => {
    render(<MergeRowsMenu {...defaultProps} isMenuOpen={true} />);

    fireEvent.click(screen.getByText('Panel 1'));
    fireEvent.click(screen.getByText('Panel 2'));
    fireEvent.click(screen.getByText('Merge'));

    fireEvent.click(screen.getByText('Yes, delete it'));

    expect(defaultProps.dashboard.removeRow).toHaveBeenCalledWith(draggedRowPanel, false);
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

  it('Should close the confirm row delete menu without calling removeRow if the keep row button is clicked', () => {
    render(<MergeRowsMenu {...defaultProps} isMenuOpen={true} />);

    fireEvent.click(screen.getByText('Panel 1'));
    fireEvent.click(screen.getByText('Panel 2'));
    fireEvent.click(screen.getByText('Merge'));

    fireEvent.click(screen.getByText('No, keep it'));

    expect(defaultProps.dashboard.removeRow).not.toHaveBeenCalled();
    expect(defaultProps.onClose).toHaveBeenCalled();
  });

});
