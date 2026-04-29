import { type CSSProperties, useEffect, useRef, useState } from 'react';

import { useCanvasEventsEffect } from '../hooks/useCanvasEventsEffect.ts';
import { useDiffImageData } from '../hooks/useDiffImageData.ts';
import type { ComparePlotsProps } from '../types.ts';

import { CanvasDiff } from './CanvasDiff.tsx';
import { CanvasHeader } from './CanvasHeader.tsx';
import { CanvasStack } from './CanvasStack.tsx';
import { CompareHeader } from './CompareHeader.tsx';
import { JestOutputModal } from './JestActions.tsx';

export function ComparePlots({
  defaultWidth,
  defaultHeight,
  payload,
  acceptBaselineState,
  onBackToIndex,
  nextFailedTestBasename,
  onGoToNextFailedTest,
  onRerunTest,
  onAcceptBaseline,
}: ComparePlotsProps) {
  const width = payload.width ?? defaultWidth;
  const height = payload.height ?? defaultHeight;
  const actualUPlotRef = useRef<HTMLCanvasElement | null>(null);
  const expectedUPlotRef = useRef<HTMLCanvasElement | null>(null);
  const expectedOverlayRef = useRef<HTMLCanvasElement | null>(null);
  const actualOverlayRef = useRef<HTMLCanvasElement | null>(null);
  const [showOverlay, setShowOverlay] = useState(false);
  const [blendMode, setBlendMode] = useState<CSSProperties['mixBlendMode']>('exclusion');
  const [renderExpectedSetupEvents, setRenderExpectedSetupEvents] = useState(true);
  const [renderActualSetupEvents, setRenderActualSetupEvents] = useState(true);
  const [renderDiffSetupEvents, setRenderDiffSetupEvents] = useState(true);
  // @todo terrible name, confuse
  const [modalDismissed, setModalDismissed] = useState(false);

  useCanvasEventsEffect(actualUPlotRef, payload.actual, payload.uPlotCanvasEvents, renderActualSetupEvents);
  useCanvasEventsEffect(expectedUPlotRef, payload.expected, payload.uPlotCanvasEvents, renderExpectedSetupEvents);

  const { hasDiff, diffImageData } = useDiffImageData({
    expectedEvents: payload.expected,
    actualEvents: payload.actual,
    setupEvents: payload.uPlotCanvasEvents,
    includeSetup: renderDiffSetupEvents,
    width,
    height,
  });

  useEffect(() => {
    if (!hasDiff && showOverlay) {
      setShowOverlay(false);
    }
  }, [hasDiff, showOverlay]);

  useEffect(() => {
    for (const overlayCanvas of [expectedOverlayRef.current, actualOverlayRef.current]) {
      const overlayContext = overlayCanvas?.getContext('2d');
      if (!overlayContext) {
        continue;
      }
      overlayContext.clearRect(0, 0, width, height);
      if (showOverlay && diffImageData) {
        overlayContext.putImageData(diffImageData, 0, 0);
      }
    }
  }, [diffImageData, height, showOverlay, width]);

  const showActualOnly = payload.snapshotAssertionPassed === true;

  const jestKind: 'idle' | 'running' | 'success' | 'error' =
    acceptBaselineState.kind === 'idle'
      ? 'idle'
      : acceptBaselineState.kind === 'running'
        ? 'running'
        : acceptBaselineState.kind === 'success'
          ? 'success'
          : 'error';

  const jestUpdateSnapshot = acceptBaselineState.kind === 'idle' ? undefined : acceptBaselineState.updateSnapshot;

  const jestMessage = acceptBaselineState.kind === 'error' ? acceptBaselineState.message : undefined;

  const jestCommand =
    acceptBaselineState.kind === 'success' || acceptBaselineState.kind === 'error'
      ? acceptBaselineState.command
      : undefined;

  const jestStdout =
    acceptBaselineState.kind === 'success' || acceptBaselineState.kind === 'error' ? acceptBaselineState.stdout : '';

  const jestStderr =
    acceptBaselineState.kind === 'success' || acceptBaselineState.kind === 'error' ? acceptBaselineState.stderr : '';

  useEffect(() => {
    if (acceptBaselineState.kind === 'running') {
      setModalDismissed(false);
    }
  }, [acceptBaselineState.kind]);

  const jestModalOpen = acceptBaselineState.kind !== 'idle' && !modalDismissed;

  return (
    <>
      <CompareHeader
        onBackToIndex={onBackToIndex}
        testName={payload.testName}
        snapshotAssertionPassed={payload.snapshotAssertionPassed}
        testPath={payload.testPath}
        jestModalDismissed={modalDismissed}
        jestKind={jestKind}
        onViewJestOutput={() => setModalDismissed(false)}
        onRerunTest={onRerunTest}
        updateSnapshot={jestUpdateSnapshot}
        onAcceptBaseline={onAcceptBaseline}
        nextFailedTestBasename={nextFailedTestBasename}
        onNextFailedTest={onGoToNextFailedTest}
      />
      <div className={`wrap${showActualOnly ? ' wrap--actual-only' : ''}`}>
        {!showActualOnly ? (
          <div className="plot-panel expected">
            <CanvasHeader
              title={'Expected'}
              onClick={() => setRenderExpectedSetupEvents((prev) => !prev)}
              showCanvasContext={renderExpectedSetupEvents}
              mixBlendMode={blendMode}
              onChangeBlendMode={setBlendMode}
              showBlend={showOverlay && hasDiff}
              hasCanvasContext={!!payload.uPlotCanvasEvents.length}
            />
            <CanvasStack
              uPlotRef={expectedUPlotRef}
              width={width}
              height={height}
              overlayRef={expectedOverlayRef}
              showOverlay={showOverlay}
              hasDiff={hasDiff}
              mixBlendMode={blendMode}
            />
          </div>
        ) : null}

        <div className="plot-panel actual">
          <CanvasHeader
            title={'Actual'}
            onClick={() => setRenderActualSetupEvents((prev) => !prev)}
            showCanvasContext={renderActualSetupEvents}
            mixBlendMode={blendMode}
            onChangeBlendMode={setBlendMode}
            showBlend={showOverlay && hasDiff}
            hasCanvasContext={!!payload.uPlotCanvasEvents.length}
          />
          <CanvasStack
            uPlotRef={actualUPlotRef}
            width={width}
            height={height}
            overlayRef={actualOverlayRef}
            showOverlay={showOverlay}
            hasDiff={hasDiff}
            mixBlendMode={blendMode}
          />
        </div>
        {!showActualOnly ? (
          <div className="diff-panel-wrap">
            <CanvasDiff
              width={width}
              height={height}
              hasDiff={hasDiff}
              diffImageData={diffImageData}
              showOverlay={showOverlay}
              onToggleOverlay={() => setShowOverlay((prev) => !prev)}
              renderDiffSetupEvents={renderDiffSetupEvents}
              onToggleDiffSetupEvents={() => setRenderDiffSetupEvents((prev) => !prev)}
              expected={payload.expected}
              actual={payload.actual}
            />
          </div>
        ) : null}
      </div>
      <JestOutputModal
        open={jestModalOpen}
        onClose={() => setModalDismissed(true)}
        kind={jestKind}
        updateSnapshot={jestUpdateSnapshot}
        message={jestMessage}
        command={jestCommand}
        stdout={jestStdout}
        stderr={jestStderr}
      />
    </>
  );
}
