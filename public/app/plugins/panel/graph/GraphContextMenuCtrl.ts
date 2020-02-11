import { ContextMenuItem } from '@grafana/ui';
import { FlotDataPoint } from '@grafana/data';

export class GraphContextMenuCtrl {
  private source?: FlotDataPoint | null;
  private scope?: any;
  menuItemsSupplier?: () => ContextMenuItem[];
  scrollContextElement: HTMLElement | null;
  position: {
    x: number;
    y: number;
  };

  isVisible: boolean;

  constructor($scope: any) {
    this.isVisible = false;
    this.scope = $scope;
  }

  onClose = () => {
    if (this.scrollContextElement) {
      this.scrollContextElement.removeEventListener('scroll', this.onClose);
    }

    this.scope.$apply(() => {
      this.isVisible = false;
    });
  };

  toggleMenu = (event?: { pageX: number; pageY: number }) => {
    this.isVisible = !this.isVisible;
    if (this.isVisible && this.scrollContextElement) {
      this.scrollContextElement.addEventListener('scroll', this.onClose);
    }

    if (this.source) {
      this.position = {
        x: this.source.pageX,
        y: this.source.pageY,
      };
    } else {
      this.position = {
        x: event ? event.pageX : 0,
        y: event ? event.pageY : 0,
      };
    }
  };

  // Sets element which is considered as a scroll context of given context menu.
  // Having access to this element allows scroll event attachement for menu to be closed when user scrolls
  setScrollContextElement = (el: HTMLElement | null) => {
    this.scrollContextElement = el;
  };

  setSource = (source: FlotDataPoint | null) => {
    this.source = source;
  };

  getSource = () => {
    return this.source;
  };

  setMenuItemsSupplier = (menuItemsSupplier: () => ContextMenuItem[]) => {
    this.menuItemsSupplier = menuItemsSupplier;
  };
}
