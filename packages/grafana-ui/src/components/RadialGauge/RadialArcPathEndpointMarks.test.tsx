import { render, RenderResult } from '@testing-library/react';

import { FieldDisplay } from '@grafana/data';

import { RadialArcPathEndpointMarks, RadialArcPathEndpointMarksProps } from './RadialArcPathEndpointMarks';
import { RadialGaugeDimensions } from './types';

const ser = new XMLSerializer();

const expectHTML = (result: RenderResult, expected: string) => {
  let actual = ser.serializeToString(result.asFragment()).replace(/xmlns=".*?" /g, '');
  expect(actual).toEqual(expected.replace(/^\s*|\n/gm, ''));
};

describe('RadialArcPathEndpointMarks', () => {
  const defaultDimensions = Object.freeze({
    centerX: 100,
    centerY: 100,
    radius: 80,
    barWidth: 20,
    vizWidth: 200,
    vizHeight: 200,
    margin: 10,
    barIndex: 0,
    thresholdsBarRadius: 0,
    thresholdsBarWidth: 0,
    thresholdsBarSpacing: 0,
    scaleLabelsFontSize: 0,
    scaleLabelsSpacing: 0,
    scaleLabelsRadius: 0,
    gaugeBottomY: 0,
  }) satisfies RadialGaugeDimensions;

  const defaultFieldDisplay = Object.freeze({
    name: 'Test',
    field: {},
    display: { text: '50', numeric: 50, color: '#FF0000' },
    hasLinks: false,
  }) satisfies FieldDisplay;

  const defaultProps = Object.freeze({
    arcLengthDeg: 90,
    dimensions: defaultDimensions,
    fieldDisplay: defaultFieldDisplay,
    startAngle: 0,
    xStart: 100,
    xEnd: 150,
    yStart: 100,
    yEnd: 50,
  }) satisfies Omit<RadialArcPathEndpointMarksProps, 'color' | 'gradient' | 'endpointMarker'>;

  it('renders the expected marks when endpointMarker is "point" w/ a static color', () => {
    expectHTML(
      render(
        <svg role="img">
          <RadialArcPathEndpointMarks {...defaultProps} endpointMarker="point" color="#FF0000" />
        </svg>
      ),
      '<svg role=\"img\"><circle cx=\"100\" cy=\"100\" r=\"4\" fill=\"#111217\" opacity=\"0.5\"/><circle cx=\"150\" cy=\"50\" r=\"4\" fill=\"#111217\" opacity=\"0.5\"/></svg>'
    );
  });

  it('renders the expected marks when endpointMarker is "point" w/ a gradient color', () => {
    expectHTML(
      render(
        <svg role="img">
          <RadialArcPathEndpointMarks
            {...defaultProps}
            endpointMarker="point"
            gradient={[
              { color: '#00FF00', percent: 0 },
              { color: '#0000FF', percent: 1 },
            ]}
          />
        </svg>
      ),
      '<svg role=\"img\"><circle cx=\"100\" cy=\"100\" r=\"4\" fill=\"#111217\" opacity=\"0.5\"/><circle cx=\"150\" cy=\"50\" r=\"4\" fill=\"#fbfbfb\" opacity=\"0.5\"/></svg>'
    );
  });

  it('renders the expected marks when endpointMarker is "glow" w/ a static color', () => {
    expectHTML(
      render(
        <svg role="img">
          <RadialArcPathEndpointMarks {...defaultProps} endpointMarker="glow" color="#FF0000" />
        </svg>
      ),
      '<svg role=\"img\"><path d=\"M 113.89185421335443 21.215379759023364 A 80 80 0 0 1 150 50\" fill=\"none\" stroke-width=\"20\" stroke-linecap=\"butt\"/></svg>'
    );
  });

  it('renders the expected marks when endpointMarker is "glow" w/ a gradient color', () => {
    expectHTML(
      render(
        <svg role="img">
          <RadialArcPathEndpointMarks
            {...defaultProps}
            endpointMarker="glow"
            gradient={[
              { color: '#00FF00', percent: 0 },
              { color: '#0000FF', percent: 1 },
            ]}
          />
        </svg>
      ),
      '<svg role=\"img\"><path d=\"M 113.89185421335443 21.215379759023364 A 80 80 0 0 1 150 50\" fill=\"none\" stroke-width=\"20\" stroke-linecap=\"butt\"/></svg>'
    );
  });

  it('does not render the start mark when arcLengthDeg is less than the minimum angle for "point" endpointMarker', () => {
    expectHTML(
      render(
        <svg role="img">
          <RadialArcPathEndpointMarks {...defaultProps} arcLengthDeg={5} endpointMarker="point" color="#FF0000" />
        </svg>
      ),
      '<svg role=\"img\"><circle cx=\"150\" cy=\"50\" r=\"4\" fill=\"#111217\" opacity=\"0.5\"/></svg>'
    );
  });

  it('does not render anything when arcLengthDeg is less than the minimum angle for "glow" endpointMarker', () => {
    expectHTML(
      render(
        <svg role="img">
          <RadialArcPathEndpointMarks {...defaultProps} arcLengthDeg={5} endpointMarker="glow" color="#FF0000" />
        </svg>
      ),
      '<svg role=\"img\"/>'
    );
  });

  it('does not render anything if endpointMarker is some other value', () => {
    expectHTML(
      render(
        <svg role="img">
          {/* @ts-ignore: confirming the component doesn't throw */}
          <RadialArcPathEndpointMarks {...defaultProps} endpointMarker="foo" />
        </svg>
      ),
      '<svg role=\"img\"/>'
    );
  });
});
