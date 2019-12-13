export class SelectionReference {
  getBoundingClientRect() {
    const selection = window.getSelection();
    const node = selection && selection.anchorNode;

    if (node && node.parentElement) {
      const rect = node.parentElement.getBoundingClientRect();
      return rect;
    }

    return {
      top: 0,
      left: 0,
      bottom: 0,
      right: 0,
      width: 0,
      height: 0,
    };
  }

  get clientWidth() {
    return this.getBoundingClientRect().width;
  }

  get clientHeight() {
    return this.getBoundingClientRect().height;
  }
}
