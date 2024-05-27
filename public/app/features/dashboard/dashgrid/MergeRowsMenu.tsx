import {css} from '@emotion/css';
import React, {ReactElement, useState} from 'react';

import {Button, IconButton, Modal} from '@grafana/ui';

import {DashboardModel, PanelModel} from '../state';

export interface MergeRowsMenuProps {
  panelMap: { [key: string]: PanelModel };
  draggedItem: ReactGridLayout.Layout | null;
  otherItem: ReactGridLayout.Layout | null;
  isMenuOpen: boolean;
  onClose: () => void;
  dashboard: DashboardModel;
}

export function MergeRowsMenu({panelMap, draggedItem, otherItem, isMenuOpen, onClose, dashboard}:
                                MergeRowsMenuProps): ReactElement | null {

  const initialDraggedRowPanelsVis = draggedItem?.i && panelMap[draggedItem.i]?.panels?.map((panel, index) => {
    const title = (panel.title === undefined ||
      panelMap[draggedItem.i]!.panels!.filter(p => p.title === panel.title).length > 1)
      ? (panel.title === undefined ? `(${index + 1})` : `${panel.title} (${index + 1})`)
      : panel.title;

    return {
      id: panel.id,
      title: title,
      dragged: true,
    };
  }) || [];

  const [draggedRowPanelsVis, setDraggedRowPanelsVis] = useState(initialDraggedRowPanelsVis);

  const initialOtherRowPanelsVis = otherItem?.i && panelMap[otherItem.i]?.panels?.map((panel, index) => {
    const title = (panel.title === undefined ||
      panelMap[otherItem.i]!.panels!.filter(p => p.title === panel.title).length > 1)
      ? (panel.title === undefined ? `(${index + 1})` : `${panel.title} (${index + 1})`)
      : panel.title;

    return {
      id: panel.id,
      title: title,
      dragged: false,
    };
  }) || [];

  const [otherRowPanelsVis, setOtherRowPanelsVis] = useState(initialOtherRowPanelsVis);

  const handlePanelSelection = (panel: {
    id: number,
    title: string,
    dragged: boolean
  }, index: number, isDragOrigin: boolean) => {
    if (isDragOrigin) {
      setOtherRowPanelsVis([...otherRowPanelsVis, panel]);
      setDraggedRowPanelsVis(draggedRowPanelsVis.filter((_, i) => i !== index));
    } else {
      setDraggedRowPanelsVis([...draggedRowPanelsVis, panel]);
      setOtherRowPanelsVis(otherRowPanelsVis.filter((_, i) => i !== index));
    }
  };

  const [showDeleteModal, setShowDeleteModal] = useState(false);

  const onMerge = () => {
    if (draggedItem && otherItem && panelMap[draggedItem.i] && panelMap[otherItem.i]) {
      // Update panels in the dragged row
      const draggedPanels = draggedRowPanelsVis.map(panel => {
        const fromDraggedRow = panelMap[draggedItem.i].panels?.find(p => p.id === panel.id);
        const fromOtherRow = panelMap[otherItem.i].panels?.find(p => p.id === panel.id);
        return fromDraggedRow || fromOtherRow!;
      });

      // Calculate the new y positions for the panels in draggedPanels
      let yRow = draggedItem.y;
      draggedPanels.forEach(panel => {
        panel.gridPos.y = yRow;
        yRow += panel.gridPos.h;
      });

      // Update panels in the other row
      const otherPanels = otherRowPanelsVis.map(panel => {
        const fromDraggedRow = panelMap[draggedItem.i].panels?.find(p => p.id === panel.id);
        const fromOtherRow = panelMap[otherItem.i].panels?.find(p => p.id === panel.id);
        return fromDraggedRow! || fromOtherRow!;
      });

      // Calculate the new y positions for the panels in otherPanels
      yRow = otherItem.y;
      otherPanels.forEach(panel => {
        panel.gridPos.y = yRow;
        yRow += panel.gridPos.h;
      });

      // Update the panel maps with the new panel configurations
      panelMap[draggedItem.i].panels = draggedPanels;
      panelMap[otherItem.i].panels = otherPanels;

      // If a row is empty, show the delete modal, otherwise simply close the merge menu
      if (panelMap[draggedItem.i].panels?.length === 0 || panelMap[otherItem.i].panels?.length === 0) {
        setShowDeleteModal(true);
      } else {
        onClose();
      }
    }
  };

  const transferAllPanels = (transferToDrag: boolean) =>{
    if (!transferToDrag){
      setOtherRowPanelsVis([...otherRowPanelsVis, ...draggedRowPanelsVis]);
      setDraggedRowPanelsVis([]);
    } else {
      setDraggedRowPanelsVis([...draggedRowPanelsVis, ...otherRowPanelsVis]);
      setOtherRowPanelsVis([]);
    }
  }

  const handleDelete = () => {
    if (draggedItem && panelMap[draggedItem.i].panels?.length === 0) {
      dashboard.removeRow(panelMap[draggedItem.i], false);
    } else if (otherItem && panelMap[otherItem.i].panels?.length === 0) {
      dashboard.removeRow(panelMap[otherItem.i], false);
    }

    setShowDeleteModal(false);
    onClose();
  };

  const buttonStyleDragged = {
    backgroundColor: 'rgba(0, 0, 255, 0.15)', // Give to the dragged button background a colour
    border: 'none',
    padding: '5px 10px',
    margin: '5px 0',
    cursor: 'pointer',
    borderRadius: '3px',
  };

  const buttonStyleOther = {
    backgroundColor: 'rgba(255, 0, 0, 0.15)', // Give to the other button background a different colour
    border: 'none',
    padding: '5px 10px',
    margin: '5px 0',
    cursor: 'pointer',
    borderRadius: '3px',
  };

  const listStyle = {
    listStyleType: 'none',
    padding: 0,
    margin: 0,
  };

  // Detect special cases
  let specialCaseString: string | null = null;
  if (draggedItem === null || otherItem === null) {
    specialCaseString = 'Failed preparing menu';
  } else if (panelMap[draggedItem.i]!.type !== 'row' || !panelMap[draggedItem.i]!.collapsed) {
    specialCaseString = 'The item you are dragging is not a collapse row'; // This should not happen
  } else if ( panelMap[otherItem.i]!.type !== 'row' || !panelMap[otherItem.i]!.collapsed) {
    specialCaseString = 'The item you have tried to drag into is not a collapse row';
  } else if (panelMap[draggedItem.i]!.panels!.length === 0 && panelMap[otherItem.i]!.panels!.length === 0) {
    specialCaseString = 'The rows have no panels to merge';
  }

  // Show special case modal if required
  if (specialCaseString !== null) {
    return (
      <Modal title="Merge Rows" isOpen={isMenuOpen} onDismiss={onClose}>
        <div style={{textAlign: 'center', marginTop: '8px'}}>
          <h3 style={{textAlign: 'center'}}>{specialCaseString}</h3>
          <div style={{textAlign: 'center', marginTop: '32px'}}>
            <Button onClick={onClose}>Close</Button>
          </div>
        </div>
      </Modal>
    );
  }

  let defaultMergeRowMenuStyles = {
    specificModal: css({
      width: '1250px',
    }),
  };

  return (
    <>
      <Modal title="Merge Rows" isOpen={isMenuOpen} onDismiss={onClose}
             className={defaultMergeRowMenuStyles.specificModal}>
        <p style={{ fontSize: '10px', textAlign: 'left', position: 'absolute', bottom: '-10px', left: '10px', color: 'rgba(255, 255, 255, 0.5)' }}>
          Click on panels to switch their rows
        </p>
        <div style={{display: 'flex', justifyContent: 'space-around'}}>
          <div data-testid="MergeRowsMenu-dragged-row"
               style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
            <h3 style={{textAlign: 'center'}}>{panelMap[draggedItem?.i!]?.title}</h3>
            <div style={{display: 'flex', alignItems: 'center'}}>
              <p style={{textAlign: 'center', fontSize: '12px', marginBottom: '6px'}}>(Dragged Row Panels)</p>
            </div>
            <IconButton
              style={{marginTop: '0px', marginBottom: '10px'}}
              tooltip="Transfer all"
              size="xl"
              tooltipPlacement="top"
              name="angle-double-right"
              onClick={() => transferAllPanels(false)}
            />
            <ul style={{...listStyle, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
              {draggedRowPanelsVis.map((panel, index) => (
                <li key={panel.id}>
                  <button
                    style={panel.dragged ? buttonStyleDragged : buttonStyleOther}
                    onClick={() => handlePanelSelection(panel, index, true)}
                  >
                    {panel.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>
          <div data-testid="MergeRowsMenu-other-row"
               style={{display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
            <h3 style={{textAlign: 'center'}}>{panelMap[otherItem?.i!]?.title}</h3>
            <p style={{textAlign: 'center', fontSize: '12px', marginBottom: '6px'}}>(Other Row Panels)</p>
            <IconButton
              style={{marginTop: '0px', marginBottom: '10px'}}
              tooltip="Transfer all"
              size="xl"
              tooltipPlacement="top"
              name="angle-double-left"
              onClick={() => transferAllPanels(true)}
            />
            <ul style={{...listStyle, display: 'flex', flexDirection: 'column', alignItems: 'center'}}>
              {otherRowPanelsVis.map((panel, index) => (
                <li key={panel.id}>
                  <button
                    style={panel.dragged ? buttonStyleDragged : buttonStyleOther}
                    onClick={() => handlePanelSelection(panel, index, false)}
                  >
                    {panel.title}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </div>
        <div style={{textAlign: 'center', marginTop: '20px'}}>
          <Button onClick={onMerge}>Merge</Button>
        </div>
      </Modal>
      <Modal title="Confirm Row Delete" isOpen={showDeleteModal} onDismiss={() => setShowDeleteModal(false)}>
        <div style={{textAlign: 'center', alignItems: 'center'}}>
          <h3>One of the rows is empty. Do you want to delete it?</h3>
          <p>This action is permanent</p>
        </div>
        <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '32px'}}>
          <Button
            style={{textAlign: 'center', marginLeft: '100px'}}
            onClick={() => {setShowDeleteModal(false); onClose();} }
          >No, keep it
          </Button>
          <Button
            style={{backgroundColor: 'red', textAlign: 'center', marginRight: '100px'}}
            onClick={handleDelete}
          >Yes, delete it
          </Button>
        </div>
      </Modal>
    </>
  );
}
