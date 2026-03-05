// Code generated - EDITING IS FUTILE. DO NOT EDIT.

export interface ColorSection {
	name?: string;
	main?: Color;
	shade?: Color;
	text?: Color;
	border?: Color;
	transparent?: Color;
	borderTransparent?: Color;
	contrastText?: Color;
}

export const defaultColorSection = (): ColorSection => ({
});

export type Color = string;

export const defaultColor = (): Color => ("");

export interface Visualization {
	hues?: Hue[];
	palette?: string[];
}

export const defaultVisualization = (): Visualization => ({
});

export type Hue = RedHue | OrangeHue | YellowHue | GreenHue | BlueHue | PurpleHue;

export const defaultHue = (): Hue => (defaultRedHue());

export interface RedHue {
	name: "red";
	shades: {
		color: string;
		name: string;
		aliases?: string[];
		primary?: boolean;
	}[];
}

export const defaultRedHue = (): RedHue => ({
	name: "red",
	shades: [],
});

export interface OrangeHue {
	name: "orange";
	shades: {
		color: string;
		name: string;
		aliases?: string[];
		primary?: boolean;
	}[];
}

export const defaultOrangeHue = (): OrangeHue => ({
	name: "orange",
	shades: [],
});

export interface YellowHue {
	name: "yellow";
	shades: {
		color: string;
		name: string;
		aliases?: string[];
		primary?: boolean;
	}[];
}

export const defaultYellowHue = (): YellowHue => ({
	name: "yellow",
	shades: [],
});

export interface GreenHue {
	name: "green";
	shades: {
		color: string;
		name: string;
		aliases?: string[];
		primary?: boolean;
	}[];
}

export const defaultGreenHue = (): GreenHue => ({
	name: "green",
	shades: [],
});

export interface BlueHue {
	name: "blue";
	shades: {
		color: string;
		name: string;
		aliases?: string[];
		primary?: boolean;
	}[];
}

export const defaultBlueHue = (): BlueHue => ({
	name: "blue",
	shades: [],
});

export interface PurpleHue {
	name: "purple";
	shades: {
		color: string;
		name: string;
		aliases?: string[];
		primary?: boolean;
	}[];
}

export const defaultPurpleHue = (): PurpleHue => ({
	name: "purple",
	shades: [],
});

export interface Spec {
	userID: string;
	name: string;
	colors?: {
		mode?: "light" | "dark";
		primary?: ColorSection;
		secondary?: ColorSection;
		info?: ColorSection;
		error?: ColorSection;
		success?: ColorSection;
		warning?: ColorSection;
		text?: {
			primary?: string;
			secondary?: string;
			disabled?: string;
			link?: string;
			maxContrast?: string;
		};
		background?: {
			canvas?: string;
			primary?: string;
			secondary?: string;
			elevated?: string;
		};
		border?: {
			weak?: string;
			medium?: string;
			strong?: string;
		};
		gradients?: {
			brandVertical?: string;
			brandHorizontal?: string;
		};
		action?: {
			selected?: string;
			selectedBorder?: string;
			hover?: string;
			hoverOpacity?: number;
			focus?: string;
			disabledBackground?: string;
			disabledText?: string;
			disabledOpacity?: number;
		};
		scrollbar?: string;
		hoverFactor?: number;
		contrastThreshold?: number;
		tonalOffset?: number;
	};
	spacing?: {
		gridSize?: number;
	};
	shape?: {
		borderRadius?: number;
	};
	typography?: {
		fontFamily?: string;
		fontFamilyMonospace?: string;
		fontSize?: number;
		fontWeightLight?: number;
		fontWeightRegular?: number;
		fontWeightMedium?: number;
		fontWeightBold?: number;
		htmlFontSize?: number;
	};
	visualization?: Visualization;
}

export const defaultSpec = (): Spec => ({
	userID: "",
	name: "",
});

