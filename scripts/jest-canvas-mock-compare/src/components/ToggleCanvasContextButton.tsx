export function ToggleCanvasContextButton(props: { onClick: () => void; showCanvasContext: boolean }) {
  return (
    <button className="plot-action-btn" type="button" onClick={props.onClick}>
      {props.showCanvasContext ? 'Hide uPlot setup' : 'Show uPlot setup'}
    </button>
  );
}
