export function ToggleCanvasContextButton(props: { onClick: () => void; showCanvasContext: boolean }) {
  return (
    <button
      title={'Toggle additional canvas context outside the scope of the test. Shared between actual and expected'}
      className="plot-action-btn"
      type="button"
      onClick={props.onClick}
    >
      {props.showCanvasContext ? 'Hide canvas context' : 'Show canvas context'}
    </button>
  );
}
