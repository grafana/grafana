define(function(req){
	var r2 = req("./amd-simplified-cjs-aliased-require2.js");
	return {
		name: "require1",
		require2: r2
	};
});
