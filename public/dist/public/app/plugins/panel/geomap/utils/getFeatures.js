import { Feature } from 'ol';
import tinycolor from 'tinycolor2';
export var getFeatures = function (frame, info, config) {
    var features = [];
    // Map each data value into new points
    for (var i = 0; i < frame.length; i++) {
        // Get the color for the feature based on color scheme
        var color = config.colorDim.get(i);
        // Get the size for the feature based on size dimension
        var size = config.sizeDim.get(i);
        // Get the text for the feature based on text dimension
        var label = (config === null || config === void 0 ? void 0 : config.textDim) ? config === null || config === void 0 ? void 0 : config.textDim.get(i) : undefined;
        // Set the opacity determined from user configuration
        var fillColor = tinycolor(color).setAlpha(config === null || config === void 0 ? void 0 : config.opacity).toRgbString();
        // Create a new Feature for each point returned from dataFrameToPoints
        var dot = new Feature(info.points[i]);
        dot.setProperties({
            frame: frame,
            rowIndex: i,
        });
        if (config === null || config === void 0 ? void 0 : config.textDim) {
            dot.setStyle(config.styleMaker({ color: color, fillColor: fillColor, size: size, text: label }));
        }
        else {
            dot.setStyle(config.styleMaker({ color: color, fillColor: fillColor, size: size }));
        }
        features.push(dot);
    }
    return features;
};
//# sourceMappingURL=getFeatures.js.map